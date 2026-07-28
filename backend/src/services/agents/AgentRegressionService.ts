import type { AgentExecutionResult } from '../../types/agent.js';
import type { AIMessage } from '../../types/index.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import type { AgentRunSpec } from './engine/AgentRunSpec.js';
import type { AgentCheckpoint, AgentSession } from './engine/AgentSession.js';

const SAMPLES_KEY = 'platform_regression_samples';
const RUNS_KEY = 'platform_regression_runs';

export type AgentEvalScorerKind =
  | 'contains'
  | 'not_contains'
  | 'exact_match'
  | 'json_parse'
  | 'json_schema'
  | 'tool_call';

export interface AgentEvalScorer {
  id?: string;
  kind: AgentEvalScorerKind;
  value?: string;
  values?: string[];
  caseSensitive?: boolean;
  schema?: AgentEvalJsonSchema;
  toolName?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentEvalJsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean';
  required?: string[];
  properties?: Record<string, AgentEvalJsonSchema>;
  items?: AgentEvalJsonSchema;
}

export interface AgentEvalBaselineRef {
  id?: string;
  agentId?: string;
  model?: string;
  promptRevision?: string;
  policyRevision?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentEvalReplaySpec {
  sourceRunId?: string;
  checkpointId?: string;
  mode?: 'input' | 'checkpoint' | 'messages';
}

export interface AgentEvalSampleInput {
  prompt?: string;
  messages?: AIMessage[];
  variables?: Record<string, unknown>;
}

export interface AgentEvalExecutionPolicy {
  tools?: 'disabled' | 'enabled';
  skills?: 'default' | 'disabled';
  timeoutMs?: number;
  maxModelCalls?: number;
  maxToolCalls?: number;
}

export interface AgentEvalScore {
  scorerId: string;
  kind: AgentEvalScorerKind | 'execution_error';
  passed: boolean;
  score: number;
  weight: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface AgentEvalReplayResult {
  sourceRunId?: string;
  checkpointId?: string;
  mode: 'input' | 'checkpoint' | 'messages';
  messageCount: number;
}

export interface RegressionSample {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  expectedContains?: string[];
  tags?: string[];
  datasetId?: string;
  input?: AgentEvalSampleInput;
  scorers?: AgentEvalScorer[];
  baseline?: AgentEvalBaselineRef;
  replay?: AgentEvalReplaySpec;
  execution?: AgentEvalExecutionPolicy;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RegressionRunRecord {
  runId: string;
  sampleId: string;
  sampleName: string;
  agentId: string;
  passed: boolean;
  outputPreview: string;
  mismatches: string[];
  durationMs?: number;
  createdAt: string;
  datasetId?: string;
  baseline?: AgentEvalBaselineRef;
  replay?: AgentEvalReplayResult;
  scores?: AgentEvalScore[];
  score?: number;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RegressionRunSummary {
  total: number;
  passed: number;
  failed: number;
  records: RegressionRunRecord[];
  score?: number;
  datasetIds?: string[];
}

interface EvalAgentService {
  runAgent(
    agentId: string,
    input: string,
    date?: string,
    options?: {
      silent?: boolean;
      noTools?: boolean;
      noSkills?: boolean;
      runSource?: 'eval';
      metadata?: Record<string, unknown>;
      messages?: AIMessage[];
      budgetPolicy?: {
        timeoutMs?: number;
        maxModelCalls?: number;
        maxToolCalls?: number;
      };
      onRunCreated?: (spec: AgentRunSpec) => void | Promise<void>;
    }
  ): Promise<AgentExecutionResult>;
  getRunSession?(runId: string): Promise<AgentSession | null>;
}

export class AgentRegressionService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async listSamples(): Promise<RegressionSample[]> {
    const items = (await this.store.get(SAMPLES_KEY)) as RegressionSample[] | undefined;
    if (!Array.isArray(items)) return [];
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveSample(sample: Omit<RegressionSample, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }) {
    const samples = await this.listSamples();
    const now = new Date().toISOString();
    const id = sample.id?.trim() || `reg_${Date.now().toString(36)}`;
    const existing = samples.find((item) => item.id === id);
    const next: RegressionSample = {
      id,
      name: sample.name,
      agentId: sample.agentId,
      prompt: sample.prompt,
      expectedContains: sample.expectedContains,
      tags: sample.tags,
      datasetId: sample.datasetId,
      input: sample.input,
      scorers: sample.scorers,
      baseline: sample.baseline,
      replay: sample.replay,
      execution: sample.execution,
      metadata: sample.metadata,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    const merged = [next, ...samples.filter((item) => item.id !== id)];
    await this.store.put(SAMPLES_KEY, merged.slice(0, 100));
    return next;
  }

  async deleteSample(sampleId: string) {
    const samples = await this.listSamples();
    await this.store.put(
      SAMPLES_KEY,
      samples.filter((item) => item.id !== sampleId)
    );
    return { status: 'success' };
  }

  async runSamples(sampleIds?: string[]): Promise<RegressionRunSummary> {
    const agentService = this.context.agentService as EvalAgentService | undefined;
    if (!agentService) throw new Error('Agent service not initialized');

    const samples = await this.listSamples();
    const targets =
      sampleIds && sampleIds.length > 0
        ? samples.filter((item) => sampleIds.includes(item.id))
        : samples;

    const records: RegressionRunRecord[] = [];
    for (const sample of targets) {
      records.push(await this.runSample(sample, agentService));
    }

    const existing = ((await this.store.get(RUNS_KEY)) as RegressionRunRecord[] | undefined) ?? [];
    await this.store.put(RUNS_KEY, [...records, ...existing].slice(0, 200));

    return {
      total: records.length,
      passed: records.filter((item) => item.passed).length,
      failed: records.filter((item) => !item.passed).length,
      score: averageScore(records),
      datasetIds: uniqueStrings(records.map((record) => record.datasetId)),
      records
    };
  }

  async listRuns(limit = 30): Promise<RegressionRunRecord[]> {
    const items = (await this.store.get(RUNS_KEY)) as RegressionRunRecord[] | undefined;
    if (!Array.isArray(items)) return [];
    return items.slice(0, Math.max(1, limit));
  }

  private async runSample(
    sample: RegressionSample,
    agentService: EvalAgentService
  ): Promise<RegressionRunRecord> {
    const started = Date.now();
    const createdAt = new Date().toISOString();
    let platformRunId = '';
    let platformSessionId = '';

    try {
      const resolvedInput = await resolveEvalInput(sample, agentService);
      const result = await agentService.runAgent(
        resolvedInput.agentId,
        resolvedInput.prompt,
        undefined,
        {
          silent: true,
          noTools: sample.execution?.tools !== 'enabled',
          noSkills: sample.execution?.skills === 'disabled',
          runSource: 'eval',
          messages: resolvedInput.messages,
          budgetPolicy: {
            timeoutMs: sample.execution?.timeoutMs,
            maxModelCalls: sample.execution?.maxModelCalls,
            maxToolCalls: sample.execution?.maxToolCalls
          },
          metadata: {
            eval: true,
            evalDatasetId: sample.datasetId,
            evalSampleId: sample.id,
            evalSampleName: sample.name,
            evalBaseline: sample.baseline,
            replay: resolvedInput.replay,
            ...(sample.metadata ?? {})
          },
          onRunCreated: (spec) => {
            platformRunId = spec.runId;
            platformSessionId = spec.sessionId;
          }
        }
      );
      const output = String(result.content || '');
      const scores = scoreEvalResult(sample, result);
      const mismatches = scores.filter((score) => !score.passed).map((score) => score.message);
      return {
        runId: platformRunId || result.trace?.runId || `eval_${sample.id}_${Date.now().toString(36)}`,
        sampleId: sample.id,
        sampleName: sample.name,
        agentId: resolvedInput.agentId,
        passed: scores.every((score) => score.passed),
        outputPreview: output.slice(0, 400),
        output,
        mismatches,
        durationMs: Date.now() - started,
        createdAt,
        datasetId: sample.datasetId,
        baseline: sample.baseline,
        replay: resolvedInput.replay,
        scores,
        score: weightedScore(scores),
        metadata: {
          sessionId: platformSessionId || undefined,
          stopReason: result.stopReason
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const scores: AgentEvalScore[] = [
        {
          scorerId: 'execution',
          kind: 'execution_error',
          passed: false,
          score: 0,
          weight: 1,
          message
        }
      ];
      return {
        runId: platformRunId || `eval_${sample.id}_${Date.now().toString(36)}`,
        sampleId: sample.id,
        sampleName: sample.name,
        agentId: sample.agentId,
        passed: false,
        outputPreview: '',
        mismatches: [message],
        durationMs: Date.now() - started,
        createdAt,
        datasetId: sample.datasetId,
        baseline: sample.baseline,
        scores,
        score: 0,
        error: message
      };
    }
  }
}

function scoreEvalResult(sample: RegressionSample, result: AgentExecutionResult): AgentEvalScore[] {
  const scorers = resolveScorers(sample);
  if (scorers.length === 0) return [];
  return scorers.map((scorer, index) => evaluateScorer(scorer, result, index));
}

function resolveScorers(sample: RegressionSample): AgentEvalScorer[] {
  const legacyContains = (sample.expectedContains ?? []).map((value, index) => ({
    id: `expected_contains_${index + 1}`,
    kind: 'contains' as const,
    value
  }));
  return [...legacyContains, ...(sample.scorers ?? [])];
}

function evaluateScorer(
  scorer: AgentEvalScorer,
  result: AgentExecutionResult,
  index: number
): AgentEvalScore {
  const scorerId = scorer.id || `${scorer.kind}_${index + 1}`;
  const weight = normalizeWeight(scorer.weight);
  const output = String(result.content || '');

  if (scorer.kind === 'contains') {
    const values = scorer.values?.length ? scorer.values : [scorer.value ?? ''];
    const missing = values.filter((value) => !includesText(output, value, scorer.caseSensitive));
    return toScore({
      scorerId,
      kind: scorer.kind,
      weight,
      passed: missing.length === 0,
      message: missing.length === 0 ? 'contains matched' : `missing: ${missing.join(', ')}`,
      details: { values, missing }
    });
  }

  if (scorer.kind === 'not_contains') {
    const values = scorer.values?.length ? scorer.values : [scorer.value ?? ''];
    const found = values.filter((value) => includesText(output, value, scorer.caseSensitive));
    return toScore({
      scorerId,
      kind: scorer.kind,
      weight,
      passed: found.length === 0,
      message: found.length === 0 ? 'not_contains matched' : `unexpected: ${found.join(', ')}`,
      details: { values, found }
    });
  }

  if (scorer.kind === 'exact_match') {
    const expected = scorer.value ?? '';
    const actual = scorer.caseSensitive ? output.trim() : output.trim().toLowerCase();
    const normalizedExpected = scorer.caseSensitive ? expected.trim() : expected.trim().toLowerCase();
    return toScore({
      scorerId,
      kind: scorer.kind,
      weight,
      passed: actual === normalizedExpected,
      message: actual === normalizedExpected ? 'exact match' : 'output does not match expected text',
      details: { expected }
    });
  }

  if (scorer.kind === 'json_parse' || scorer.kind === 'json_schema') {
    const parsed = parseJsonOutput(output);
    if (!parsed.ok) {
      return toScore({
        scorerId,
        kind: scorer.kind,
        weight,
        passed: false,
        message: parsed.error,
        details: { outputPreview: output.slice(0, 200) }
      });
    }
    const errors = scorer.kind === 'json_schema' && scorer.schema
      ? validateJsonSchema(parsed.value, scorer.schema)
      : [];
    return toScore({
      scorerId,
      kind: scorer.kind,
      weight,
      passed: errors.length === 0,
      message: errors.length === 0 ? 'json matched' : errors.join('; '),
      details: { errors }
    });
  }

  const toolCalls = collectToolCalls(result);
  const matched = toolCalls.some((toolCall) => toolCall.name === scorer.toolName);
  return toScore({
    scorerId,
    kind: scorer.kind,
    weight,
    passed: matched,
    message: matched ? `tool called: ${scorer.toolName}` : `tool not called: ${scorer.toolName}`,
    details: { toolName: scorer.toolName, toolCalls }
  });
}

async function resolveEvalInput(
  sample: RegressionSample,
  agentService: EvalAgentService
): Promise<{
  agentId: string;
  prompt: string;
  messages?: AIMessage[];
  replay?: AgentEvalReplayResult;
}> {
  if (sample.replay?.sourceRunId && agentService.getRunSession) {
    const session = await agentService.getRunSession(sample.replay.sourceRunId);
    if (session) {
      const checkpoint = resolveCheckpoint(session, sample.replay.checkpointId);
      const sourceMessages = checkpoint?.messages ?? session.messages;
      const messages = toAiMessages(sourceMessages);
      return {
        agentId: sample.agentId || String(session.metadata?.agentId || ''),
        prompt: sample.input?.prompt || sample.prompt || lastUserPrompt(messages),
        messages,
        replay: {
          sourceRunId: session.runId,
          checkpointId: checkpoint?.checkpointId,
          mode: checkpoint ? 'checkpoint' : sample.replay.mode ?? 'messages',
          messageCount: messages.length
        }
      };
    }
  }

  const messages = sample.input?.messages;
  return {
    agentId: sample.agentId,
    prompt: sample.input?.prompt || sample.prompt,
    messages,
    replay: sample.replay?.sourceRunId
      ? {
          sourceRunId: sample.replay.sourceRunId,
          checkpointId: sample.replay.checkpointId,
          mode: sample.replay.mode ?? 'input',
          messageCount: messages?.length ?? 0
        }
      : undefined
  };
}

function resolveCheckpoint(session: AgentSession, checkpointId?: string): AgentCheckpoint | undefined {
  if (checkpointId) return session.checkpoints.find((checkpoint) => checkpoint.checkpointId === checkpointId);
  return session.checkpoints.at(-1);
}

function toAiMessages(messages: AgentSession['messages']): AIMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'system' && message.role !== 'user' && message.role !== 'assistant' && message.role !== 'tool') {
      return [];
    }
    return [
      {
        role: message.role,
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
        name: message.name,
        tool_call_id: message.toolCallId,
        tool_calls: message.metadata?.toolCalls as AIMessage['tool_calls']
      }
    ];
  });
}

function lastUserPrompt(messages?: AIMessage[]): string {
  const message = [...(messages ?? [])].reverse().find((item) => item.role === 'user');
  return String(message?.content || '');
}

function includesText(output: string, value: string, caseSensitive?: boolean): boolean {
  if (!value) return true;
  if (caseSensitive) return output.includes(value);
  return output.toLowerCase().includes(value.toLowerCase());
}

function parseJsonOutput(output: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(output) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'invalid json' };
  }
}

function validateJsonSchema(value: unknown, schema: AgentEvalJsonSchema, path = '$'): string[] {
  const errors: string[] = [];
  if (schema.type && !matchesJsonType(value, schema.type)) {
    errors.push(`${path} expected ${schema.type}`);
    return errors;
  }
  if (schema.type === 'object' || schema.properties || schema.required) {
    if (!isRecord(value)) return [`${path} expected object`];
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateJsonSchema(value[key], childSchema, `${path}.${key}`));
    }
  }
  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    value.forEach((item, index) => errors.push(...validateJsonSchema(item, schema.items!, `${path}[${index}]`)));
  }
  return errors;
}

function matchesJsonType(value: unknown, type: NonNullable<AgentEvalJsonSchema['type']>): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

function collectToolCalls(result: AgentExecutionResult): Array<{ id?: string; name?: string; arguments?: unknown }> {
  const direct = (result.toolCalls ?? []).map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments
  }));
  const fromTrace = (result.trace?.rounds ?? []).flatMap((round) =>
    (round.toolCalls ?? []).map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.name,
      arguments: toolCall.arguments
    }))
  );
  return [...direct, ...fromTrace];
}

function toScore(input: Omit<AgentEvalScore, 'score'> & { passed: boolean }): AgentEvalScore {
  return {
    ...input,
    score: input.passed ? 1 : 0
  };
}

function weightedScore(scores: AgentEvalScore[]): number {
  if (scores.length === 0) return 1;
  const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return scores.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

function averageScore(records: RegressionRunRecord[]): number {
  if (records.length === 0) return 1;
  return records.reduce((sum, record) => sum + (record.score ?? (record.passed ? 1 : 0)), 0) / records.length;
}

function normalizeWeight(weight: unknown): number {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}