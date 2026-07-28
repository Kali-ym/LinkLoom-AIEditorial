import type { AgentToolObservation } from '../../../types/agent.js';
import { normalizeToolArguments } from '../runtime/toolProtocol.js';

export type ObservationProgressKind = 'progress' | 'no_progress' | 'error';

export interface ObservationPolicy {
  enabled?: boolean;
  /** 同一工具 + 同一参数出现多少次无进展 observation 后，下一次相同调用会被平台拦截。 */
  maxRepeatedNoProgress?: number;
  /** 平台已注入拦截 observation 后，模型仍继续重复相同调用时允许的次数。 */
  maxGuardedRepeats?: number;
  /** 是否把真实工具错误也纳入 observation policy。默认关闭，保留 toolErrorStrategy 处理错误。 */
  includeErrors?: boolean;
  noProgressStatuses?: string[];
  noProgressBooleanFields?: string[];
  noProgressEmptyArrayFields?: string[];
  /** 工具缓存命中仍应视为有效 observation，不应触发重复无进展拦截。 */
  ignoreCachedResults?: boolean;
  /** summary 中「未找到」等措辞仍可能是有效结果，跳过文本启发式。 */
  ignoreTextNoProgress?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ObservationPolicyClassification {
  kind: ObservationProgressKind;
  reason?: string;
  summary?: string;
  resultHash?: string;
}

export interface ObservationGuardDecision {
  action: 'allow' | 'block' | 'stop';
  reason?: string;
  content?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ObservationPolicyTracker {
  beforeToolCall(input: { toolName: string; arguments: unknown }): ObservationGuardDecision;
  recordObservation(input: {
    toolName: string;
    arguments: unknown;
    observation: AgentToolObservation;
  }): ObservationPolicyClassification;
}

interface StoredObservationState {
  callKey: string;
  signatureKey: string;
  count: number;
  classification: ObservationPolicyClassification;
  lastContent: string;
}

const DEFAULT_NO_PROGRESS_STATUSES = [
  'limited',
  'skipped',
  'blocked',
  'empty',
  'not_found',
  'no_results',
  'no_match',
  'unchanged',
  'noop',
  'error',
  'failed',
  'failure'
];

const DEFAULT_FALSE_FIELDS = ['success', 'found', 'matched', 'hasMatch', 'hasKeywordMatch'];

const DEFAULT_EMPTY_ARRAY_FIELDS = [
  'candidates',
  'results',
  'items',
  'matches',
  'resources',
  'changes'
];

export function createObservationPolicyTracker(
  policy?: ObservationPolicy
): ObservationPolicyTracker | undefined {
  if (!policy || policy.enabled === false) return undefined;

  const maxRepeatedNoProgress = normalizePositiveInteger(policy.maxRepeatedNoProgress) ?? 1;
  const maxGuardedRepeats = normalizePositiveInteger(policy.maxGuardedRepeats) ?? 1;
  const noProgressByCall = new Map<string, StoredObservationState>();
  const guardCounts = new Map<string, number>();

  return {
    beforeToolCall(input) {
      const callKey = createToolCallKey(input.toolName, input.arguments);
      const previous = noProgressByCall.get(callKey);
      if (!previous || previous.count < maxRepeatedNoProgress) return { action: 'allow' };

      const guardCount = guardCounts.get(previous.signatureKey) || 0;
      const summary = [
        `平台已检测到工具 ${input.toolName} 使用相同参数重复产生相同的无进展 observation。`,
        '不要再次调用同一工具和参数；请基于已有 observation 总结结论、调整参数，或向用户提出澄清问题。'
      ].join('');
      const data = {
        status: 'blocked',
        blocked: true,
        reason: 'repeated_no_progress_observation',
        toolName: input.toolName,
        repeatedCount: previous.count,
        guardCount,
        previousReason: previous.classification.reason,
        previousSummary: previous.classification.summary,
        previousResultHash: previous.classification.resultHash,
        instruction: '停止重复调用同一工具和参数；必须改参、总结已有结果或向用户澄清。'
      };
      const content = JSON.stringify({ summary, ...data });

      if (guardCount >= maxGuardedRepeats) {
        return {
          action: 'stop',
          reason: 'repeated_tool_observation',
          content,
          data,
          error: summary
        };
      }

      guardCounts.set(previous.signatureKey, guardCount + 1);
      return {
        action: 'block',
        reason: 'repeated_tool_observation',
        content,
        data,
        error: summary
      };
    },

    recordObservation(input) {
      const classification = classifyObservation(input.observation, policy);
      const callKey = createToolCallKey(input.toolName, input.arguments);
      if (classification.kind === 'progress' || (classification.kind === 'error' && !policy.includeErrors)) {
        noProgressByCall.delete(callKey);
        return classification;
      }

      const signatureKey = createObservationSignatureKey(
        input.toolName,
        input.arguments,
        classification.resultHash || stableValueHash(input.observation)
      );
      const previous = noProgressByCall.get(callKey);
      noProgressByCall.set(callKey, {
        callKey,
        signatureKey,
        count: previous?.signatureKey === signatureKey ? previous.count + 1 : 1,
        classification,
        lastContent: input.observation.content
      });
      return classification;
    }
  };
}

export function classifyObservation(
  observation: AgentToolObservation,
  policy?: ObservationPolicy
): ObservationPolicyClassification {
  const payload = observationPayload(observation);
  const resultHash = createObservationResultSignature(observation);
  const noProgress = detectNoProgressObservation(observation, payload, policy);

  if (noProgress) {
    return {
      kind: 'no_progress',
      reason: noProgress,
      summary: summarizeObservation(observation, payload),
      resultHash
    };
  }

  if (!observation.success) {
    return {
      kind: 'error',
      reason: 'tool_error',
      summary: summarizeObservation(observation, payload),
      resultHash
    };
  }

  return { kind: 'progress', resultHash };
}

function detectNoProgressObservation(
  observation: AgentToolObservation,
  payload: Record<string, unknown>,
  policy?: ObservationPolicy
): string | undefined {
  const noProgressStatuses = new Set(
    (policy?.noProgressStatuses || DEFAULT_NO_PROGRESS_STATUSES).map((item) =>
      item.trim().toLowerCase()
    )
  );
  const payloads = expandObservationPayloads(payload);

  for (const candidate of payloads) {
    const status = stringField(candidate, 'status').toLowerCase();
    if (status && noProgressStatuses.has(status)) return `status:${status}`;
  }

  for (const field of ['limited', 'skipped', 'blocked'] as const) {
    if (payloads.some((candidate) => booleanField(candidate, field) === true)) return `${field}:true`;
  }

  if (!policy?.ignoreCachedResults) {
    if (payloads.some((candidate) => booleanField(candidate, 'cached') === true)) return 'cached:true';
  }

  for (const field of policy?.noProgressBooleanFields || DEFAULT_FALSE_FIELDS) {
    if (payloads.some((candidate) => booleanField(candidate, field) === false)) return `${field}:false`;
  }

  for (const field of policy?.noProgressEmptyArrayFields || DEFAULT_EMPTY_ARRAY_FIELDS) {
    if (payloads.some((candidate) => {
      const value = candidate[field];
      return Array.isArray(value) && value.length === 0;
    })) {
      return `${field}:empty`;
    }
  }

  if (!policy?.ignoreTextNoProgress) {
    const content = observation.content.toLowerCase();
    if (
      observation.success &&
      (content.includes('未找到') ||
        content.includes('不存在') ||
        content.includes('没有可') ||
        content.includes('无结果') ||
        content.includes('no results') ||
        content.includes('not found') ||
        content.includes('no match'))
    ) {
      return 'text:no_progress';
    }
  }

  return undefined;
}

function expandObservationPayloads(payload: Record<string, unknown>): Record<string, unknown>[] {
  const payloads: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    if (seen.has(record)) return;
    seen.add(record);
    payloads.push(record);

    for (const key of ['data', 'result', 'reactObservation', 'observation']) {
      visit(record[key]);
    }
  };

  visit(payload);
  return payloads;
}

function observationPayload(observation: AgentToolObservation): Record<string, unknown> {
  if (observation.data && typeof observation.data === 'object' && !Array.isArray(observation.data)) {
    return observation.data as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(observation.content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function summarizeObservation(
  observation: AgentToolObservation,
  payload: Record<string, unknown> = observationPayload(observation)
): string {
  const summary = payload.summary;
  if (typeof summary === 'string' && summary.trim()) return truncate(summary, 240);
  if (observation.error) return truncate(observation.error, 240);
  return truncate(observation.content, 240);
}

function createObservationSignatureKey(toolName: string, args: unknown, resultHash: string): string {
  return stableValueHash({
    toolName,
    args: normalizeArgs(toolName, args),
    resultHash
  });
}

function createToolCallKey(toolName: string, args: unknown): string {
  return stableValueHash({ toolName, args: normalizeArgs(toolName, args) });
}

function normalizeArgs(toolName: string, args: unknown): Record<string, unknown> {
  return normalizeToolArguments(toolName, args).args;
}

function createObservationResultSignature(observation: AgentToolObservation): string {
  return stableValueHash({
    success: observation.success,
    content: observation.content,
    data: observation.data,
    error: observation.error
  });
}

function stableValueHash(value: unknown): string {
  try {
    return JSON.stringify(sortStableValue(value));
  } catch {
    return String(value);
  }
}

function sortStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortStableValue(record[key])])
  );
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function booleanField(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}...`;
}