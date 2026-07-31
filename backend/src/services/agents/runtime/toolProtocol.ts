import type {
  AgentDefinition,
  ToolDefinition,
  ToolExecutionErrorTrace,
  ToolExecutionPolicy,
  ToolExecutionRiskLevel,
  ToolExecutionSource,
  ToolExecutionTrace,
  ToolExecutionValidationTrace,
  ToolRetryPolicy,
  ToolSandboxTrace
} from '../../../types/agent.js';

export interface NormalizedToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments: unknown;
  source: 'provider' | 'stream' | 'runtime';
  parseError?: string;
}

export type ToolExecutionErrorCode =
  | 'validation_error'
  | 'timeout'
  | 'aborted'
  | 'not_found'
  | 'sandbox_denied'
  | 'network_unavailable'
  | 'execution_error';

export interface ToolExecutionEnvelopeRetryPolicy
  extends Required<Pick<ToolRetryPolicy, 'maxAttempts' | 'backoffMs'>> {
  retryOn?: string[];
  allowNonReadonly?: boolean;
}

export interface ToolExecutionEnvelope {
  envelopeId: string;
  toolId: string;
  exposedName: string;
  originalName?: string;
  source: ToolExecutionSource;
  schemaVersion: 'tool-execution-envelope-v1';
  arguments: Record<string, unknown>;
  validation: ToolExecutionValidationTrace;
  riskLevel: ToolExecutionRiskLevel;
  readonly: boolean;
  parallelizable: boolean;
  concurrencySafe: boolean;
  timeoutMs?: number;
  retryPolicy: ToolExecutionEnvelopeRetryPolicy;
  permission?: unknown;
  workspace?: unknown;
  sandbox?: ToolSandboxTrace;
  result?: unknown;
  error?: ToolExecutionErrorTrace;
  attempts: number;
  durationMs: number;
  artifactRefs?: string[];
  mcp?: ToolExecutionTrace['mcp'];
}

export interface ToolExecutionEnvelopeOptions {
  toolId: string;
  exposedName?: string;
  originalName?: string;
  source?: ToolExecutionSource;
  arguments: unknown;
  toolDef?: Pick<ToolDefinition, 'parameters' | 'uiHints' | 'execution'>;
  execution?: ToolExecutionPolicy;
  permission?: unknown;
  workspace?: unknown;
  sandbox?: (args: Record<string, unknown>) => ToolSandboxTrace | undefined;
  signal?: AbortSignal;
  execute: (args: Record<string, unknown>, signal?: AbortSignal, attempt?: number) => Promise<unknown> | unknown;
}

export class ToolExecutionEnvelopeError extends Error {
  readonly envelope: ToolExecutionEnvelope;

  constructor(envelope: ToolExecutionEnvelope) {
    super(envelope.error?.message || `Tool ${envelope.exposedName} execution failed`);
    this.name = 'ToolExecutionEnvelopeError';
    this.envelope = envelope;
  }
}

export function getToolExecutionEnvelopeFromError(
  error: unknown
): ToolExecutionEnvelope | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const envelope = (error as { envelope?: unknown }).envelope;
  return isToolExecutionEnvelope(envelope) ? envelope : undefined;
}

export function toolExecutionEnvelopeToTrace(
  envelope: ToolExecutionEnvelope
): ToolExecutionTrace {
  return {
    envelopeId: envelope.envelopeId,
    toolId: envelope.toolId,
    exposedName: envelope.exposedName,
    originalName: envelope.originalName,
    source: envelope.source,
    schemaVersion: envelope.schemaVersion,
    validation: envelope.validation,
    riskLevel: envelope.riskLevel,
    readonly: envelope.readonly,
    parallelizable: envelope.parallelizable,
    concurrencySafe: envelope.concurrencySafe,
    timeoutMs: envelope.timeoutMs,
    retryPolicy: envelope.retryPolicy,
    attempts: envelope.attempts,
    durationMs: envelope.durationMs,
    error: envelope.error,
    sandbox: envelope.sandbox,
    mcp: envelope.mcp
  };
}

export function describeToolExecution(
  toolId: string,
  exposedName: string,
  toolDef?: Pick<ToolDefinition, 'execution'>,
  source: ToolExecutionSource = 'local',
  originalName?: string
): ToolExecutionTrace {
  const policy = normalizeToolExecutionPolicy(toolDef?.execution);
  return {
    toolId,
    exposedName,
    originalName,
    source,
    schemaVersion: 'tool-execution-envelope-v1',
    riskLevel: policy.riskLevel,
    readonly: policy.readonly,
    parallelizable: policy.parallelizable,
    concurrencySafe: policy.concurrencySafe,
    timeoutMs: policy.timeoutMs,
    retryPolicy: policy.retryPolicy,
    attempts: 0,
    durationMs: 0,
    ...(originalName ? { originalName } : {}),
    ...(exposedName !== toolId ? { envelopeId: `${source}:${toolId}:${exposedName}` } : {})
  };
}

export async function executeWithToolEnvelope(
  options: ToolExecutionEnvelopeOptions
): Promise<ToolExecutionEnvelope> {
  const startedAt = Date.now();
  const source = options.source || 'local';
  const exposedName = options.exposedName || options.toolId;
  const normalized = normalizeToolArguments(exposedName, options.arguments);
  const policy = normalizeToolExecutionPolicy(options.execution || options.toolDef?.execution);
  const envelopeBase = (): ToolExecutionEnvelope => ({
    envelopeId: createToolEnvelopeId(source, options.toolId, exposedName),
    toolId: options.toolId,
    exposedName,
    originalName: options.originalName,
    source,
    schemaVersion: 'tool-execution-envelope-v1',
    arguments: normalized.args,
    validation: {
      ok: true,
      missingRequired: [],
      typeErrors: [],
      warning: normalized.parseError,
      code: normalized.parseError ? 'arguments_parse_warning' : undefined
    },
    riskLevel: policy.riskLevel,
    readonly: policy.readonly,
    parallelizable: policy.parallelizable,
    concurrencySafe: policy.concurrencySafe,
    timeoutMs: policy.timeoutMs,
    retryPolicy: policy.retryPolicy,
    permission: options.permission,
    workspace: options.workspace,
    attempts: 0,
    durationMs: Date.now() - startedAt
  });

  const validation = validateToolArguments(exposedName, normalized.args, options.toolDef);
  if (!validation.ok) {
    return {
      ...envelopeBase(),
      arguments: validation.args,
      validation: toValidationTrace(validation, normalized.parseError),
      error: {
        code: 'validation_error',
        message: new ToolArgumentValidationError(exposedName, validation).message,
        retryable: false,
        attempt: 0
      },
      durationMs: Date.now() - startedAt
    };
  }

  const sandbox = options.sandbox?.(validation.args);
  if (sandbox?.effect === 'deny') {
    return {
      ...envelopeBase(),
      arguments: validation.args,
      validation: toValidationTrace(validation, normalized.parseError),
      sandbox,
      error: {
        code: 'sandbox_denied',
        message: sandbox.reason || `Tool ${exposedName} denied by workspace sandbox policy`,
        retryable: false,
        attempt: 0,
        details: sandbox
      },
      durationMs: Date.now() - startedAt
    };
  }

  const maxAttempts = shouldAllowRetry(policy) ? policy.retryPolicy.maxAttempts : 1;
  let lastError: ToolExecutionErrorTrace | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runToolAttempt({
        timeoutMs: policy.timeoutMs,
        parentSignal: options.signal,
        execute: (signal) => options.execute(validation.args, signal, attempt)
      });
      return {
        ...envelopeBase(),
        arguments: validation.args,
        validation: toValidationTrace(validation, normalized.parseError),
        sandbox,
        result,
        attempts: attempt,
        durationMs: Date.now() - startedAt
      };
    } catch (error: any) {
      lastError = toExecutionErrorTrace(error, attempt);
      if (attempt >= maxAttempts || !shouldRetryToolError(lastError, policy.retryPolicy)) {
        return {
          ...envelopeBase(),
          arguments: validation.args,
          validation: toValidationTrace(validation, normalized.parseError),
          sandbox,
          error: lastError,
          attempts: attempt,
          durationMs: Date.now() - startedAt
        };
      }
      try {
        await sleep(policy.retryPolicy.backoffMs * attempt, options.signal);
      } catch (error) {
        const abortedDuringBackoff = toExecutionErrorTrace(error, attempt);
        return {
          ...envelopeBase(),
          arguments: validation.args,
          validation: toValidationTrace(validation, normalized.parseError),
          sandbox,
          error: abortedDuringBackoff,
          attempts: attempt,
          durationMs: Date.now() - startedAt
        };
      }
    }
  }

  return {
    ...envelopeBase(),
    arguments: validation.args,
    validation: toValidationTrace(validation, normalized.parseError),
    sandbox,
    error: lastError || {
      code: 'execution_error',
      message: `Tool ${exposedName} execution failed`,
      retryable: false
    },
    attempts: maxAttempts,
    durationMs: Date.now() - startedAt
  };
}


function isToolExecutionEnvelope(value: unknown): value is ToolExecutionEnvelope {
  return !!value && typeof value === 'object' && (value as ToolExecutionEnvelope).schemaVersion === 'tool-execution-envelope-v1';
}

function createToolEnvelopeId(
  source: ToolExecutionSource,
  toolId: string,
  exposedName: string
): string {
  return `${source}:${toolId}:${exposedName}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeToolExecutionPolicy(
  policy?: ToolExecutionPolicy
): Required<Pick<ToolExecutionPolicy, 'readonly' | 'parallelizable' | 'concurrencySafe' | 'riskLevel'>> & {
  timeoutMs?: number;
  retryPolicy: ToolExecutionEnvelopeRetryPolicy;
} {
  const maxAttempts = Math.max(1, Math.floor(policy?.retryPolicy?.maxAttempts || 1));
  const backoffMs = Math.max(0, Math.floor(policy?.retryPolicy?.backoffMs || 0));
  const concurrencySafe = policy?.concurrencySafe === true || policy?.parallelizable === true;
  return {
    readonly: policy?.readonly === true,
    parallelizable: policy?.parallelizable === true,
    concurrencySafe,
    riskLevel: policy?.riskLevel || 'medium',
    timeoutMs:
      typeof policy?.timeoutMs === 'number' && Number.isFinite(policy.timeoutMs) && policy.timeoutMs > 0
        ? Math.floor(policy.timeoutMs)
        : undefined,
    retryPolicy: {
      maxAttempts,
      backoffMs,
      retryOn: policy?.retryPolicy?.retryOn,
      allowNonReadonly: policy?.retryPolicy?.allowNonReadonly
    }
  };
}

function shouldAllowRetry(
  policy: ReturnType<typeof normalizeToolExecutionPolicy>
): boolean {
  if (policy.retryPolicy.maxAttempts <= 1) return false;
  return policy.readonly || policy.retryPolicy.allowNonReadonly === true;
}

function shouldRetryToolError(
  error: ToolExecutionErrorTrace,
  retryPolicy: ToolExecutionEnvelopeRetryPolicy
): boolean {
  if (error.retryable === false) return false;
  const retryOn = retryPolicy.retryOn || [];
  if (retryOn.length === 0) return error.code === 'timeout' || error.code === 'execution_error';
  return retryOn.includes(error.code);
}

function toValidationTrace(
  validation: ToolArgumentValidationResult,
  warning?: string
): ToolExecutionValidationTrace {
  return {
    ok: validation.ok,
    missingRequired: validation.missingRequired,
    typeErrors: validation.typeErrors,
    warning,
    code: validation.ok ? (warning ? 'arguments_parse_warning' : undefined) : 'validation_error'
  };
}

function toExecutionErrorTrace(error: unknown, attempt: number): ToolExecutionErrorTrace {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const message = error instanceof Error ? error.message : String(error || 'Tool execution failed');
  const code = classifyToolExecutionError(error);
  return {
    code,
    message,
    retryable:
      typeof record.retryable === 'boolean'
        ? record.retryable
        : code === 'timeout' || code === 'execution_error',
    attempt,
    details: record.details
  };
}

function classifyToolExecutionError(error: unknown): ToolExecutionErrorCode {
  if (error instanceof ToolArgumentValidationError) return 'validation_error';
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const name = String(record.name || '');
  const code = String(record.code || '');
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = `${name} ${code} ${message}`.toLowerCase();
  if (code === 'SANDBOX_DENIED' || name === 'WorkspaceSandboxDeniedError') return 'sandbox_denied';
  if (code === 'WEB_SEARCH_NETWORK_UNAVAILABLE' || name === 'WebSearchNetworkError') {
    return 'network_unavailable';
  }
  if (normalized.includes('timeout') || normalized.includes('timed out')) return 'timeout';
  if (name === 'AbortError' || code === 'ABORT_ERR' || normalized.includes('abort')) return 'aborted';
  if (normalized.includes('not found') || normalized.includes('未找到')) return 'not_found';
  return 'execution_error';
}

function createTimeoutError(timeoutMs: number): Error {
  const error = new Error(`Tool execution timed out after ${timeoutMs}ms`);
  error.name = 'ToolTimeoutError';
  return error;
}

async function runToolAttempt(options: {
  timeoutMs?: number;
  parentSignal?: AbortSignal;
  execute: (signal?: AbortSignal) => Promise<unknown> | unknown;
}): Promise<unknown> {
  if (options.parentSignal?.aborted) throw createAbortError();

  const hasExecutionBoundary = !!options.parentSignal || !!options.timeoutMs;
  const controller = hasExecutionBoundary ? new AbortController() : undefined;
  let parentAbortReject: ((error: Error) => void) | undefined;
  const onAbort = () => {
    const abortError = createAbortError();
    controller?.abort(options.parentSignal?.reason ?? abortError);
    parentAbortReject?.(abortError);
  };
  options.parentSignal?.addEventListener('abort', onAbort, { once: true });

  let timeout: NodeJS.Timeout | undefined;
  let timeoutError: Error | undefined;
  const tasks: Array<Promise<unknown>> = [Promise.resolve().then(() => options.execute(controller?.signal))];
  if (options.parentSignal) {
    tasks.push(
      new Promise((_, reject) => {
        parentAbortReject = reject;
      })
    );
  }
  if (options.timeoutMs) {
    tasks.push(
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          timeoutError = createTimeoutError(options.timeoutMs!);
          controller?.abort(timeoutError);
          reject(timeoutError);
        }, options.timeoutMs);
      })
    );
  }

  try {
    return await Promise.race(tasks);
  } catch (error) {
    if (timeoutError) throw timeoutError;
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    parentAbortReject = undefined;
    options.parentSignal?.removeEventListener('abort', onAbort);
  }
}

function createAbortError(): Error {
  const error = new Error('Tool execution aborted');
  error.name = 'AbortError';
  return error;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup();
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface ToolArgumentValidationResult {
  ok: boolean;
  args: Record<string, unknown>;
  missingRequired: string[];
  typeErrors: string[];
  warning?: string;
}

export class ToolArgumentValidationError extends Error {
  readonly result: ToolArgumentValidationResult;

  constructor(toolName: string, result: ToolArgumentValidationResult) {
    const details = [
      result.missingRequired.length ? `缺少必填参数: ${result.missingRequired.join(', ')}` : '',
      result.typeErrors.length ? `参数类型错误: ${result.typeErrors.join('; ')}` : '',
      result.warning || ''
    ]
      .filter(Boolean)
      .join('；');
    super(`${toolName} 参数无效：${details}`);
    this.name = 'ToolArgumentValidationError';
    this.result = result;
  }
}

const QUERY_TOOL_NAMES = new Set(['query_knowledge', 'query_memory']);
const QUERY_ALIASES = ['q', 'keyword', 'keywords', 'text', 'question', 'content', 'search', 'term'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseStringArguments(value: string): {
  args: Record<string, unknown>;
  parseError?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) return { args: {} };

  try {
    const parsed = JSON.parse(trimmed);
    if (isRecord(parsed)) return { args: parsed };
    return { args: { _rawInput: parsed } };
  } catch (error: any) {
    return { args: { _rawInput: value }, parseError: error?.message || String(error) };
  }
}

export function normalizeToolArguments(
  toolName: string,
  rawArguments: unknown
): { args: Record<string, unknown>; parseError?: string } {
  if (isRecord(rawArguments)) return { args: { ...rawArguments } };

  if (typeof rawArguments === 'string') {
    const parsed = parseStringArguments(rawArguments);
    if (
      QUERY_TOOL_NAMES.has(toolName) &&
      !parsed.args.query &&
      parsed.args._rawInput !== undefined
    ) {
      parsed.args.query = parsed.args._rawInput;
      delete parsed.args._rawInput;
    }
    return parsed;
  }

  if (rawArguments === undefined || rawArguments === null) return { args: {} };
  return { args: { _rawInput: rawArguments } };
}

export function normalizeToolCall(
  toolCall: { id?: string; name: string; arguments?: unknown },
  source: NormalizedToolCall['source'] = 'provider'
): NormalizedToolCall {
  const normalized = normalizeToolArguments(toolCall.name, toolCall.arguments);
  return {
    id: toolCall.id,
    name: toolCall.name,
    arguments: normalized.args,
    rawArguments: toolCall.arguments,
    source,
    parseError: normalized.parseError
  };
}

export function normalizeToolCalls(
  toolCalls: Array<{ id?: string; name: string; arguments?: unknown }> | undefined,
  source: NormalizedToolCall['source'] = 'provider'
): NormalizedToolCall[] {
  return (toolCalls || []).map((toolCall) => normalizeToolCall(toolCall, source));
}

function getArgumentAliases(toolDef?: Pick<ToolDefinition, 'uiHints'>): Record<string, string[]> {
  const aliases = toolDef?.uiHints?.argumentAliases;
  return isRecord(aliases) ? (aliases as Record<string, string[]>) : {};
}

function normalizeAliasValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined && item !== null)
      .join(' ')
      .trim();
  }
  return value;
}

export function applyToolArgumentAliases(
  toolName: string,
  args: Record<string, unknown>,
  toolDef?: Pick<ToolDefinition, 'uiHints'>
): Record<string, unknown> {
  const merged = { ...args };
  const configuredAliases = getArgumentAliases(toolDef);
  const aliases = {
    ...(QUERY_TOOL_NAMES.has(toolName) ? { query: QUERY_ALIASES } : {}),
    ...configuredAliases
  };

  for (const [target, sourceKeys] of Object.entries(aliases)) {
    if (merged[target] !== undefined && merged[target] !== null && String(merged[target]).trim())
      continue;
    for (const key of sourceKeys || []) {
      const value = merged[key];
      if (value === undefined || value === null) continue;
      const normalized = normalizeAliasValue(value);
      if (normalized === undefined || normalized === null || !String(normalized).trim()) continue;
      merged[target] = normalized;
      break;
    }
  }

  return merged;
}

function getSchemaType(schema: any): string | undefined {
  if (!schema) return undefined;
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.oneOf)) {
    return undefined;
  }
  return undefined;
}

function matchesSchemaType(value: unknown, schema: any): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(schema?.oneOf)) {
    return schema.oneOf.some((candidate: any) => matchesSchemaType(value, candidate));
  }

  const type = getSchemaType(schema);
  if (!type) return true;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string') return typeof value === 'string';
  return true;
}

function coerceValueForSchema(value: unknown, schema: any): unknown {
  if (value === undefined || value === null) return value;
  if (Array.isArray(schema?.oneOf)) {
    for (const candidate of schema.oneOf) {
      const coerced = coerceValueForSchema(value, candidate);
      if (matchesSchemaType(coerced, candidate)) return coerced;
    }
    return value;
  }

  const type = getSchemaType(schema);
  if ((type === 'number' || type === 'integer') && typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return value;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && (type === 'number' || Number.isInteger(numeric))) {
      return numeric;
    }
  }
  return value;
}

function coerceToolArgumentTypes(
  args: Record<string, unknown>,
  properties: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, coerceValueForSchema(value, properties[key])])
  );
}

export function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  toolDef?: Pick<ToolDefinition, 'parameters' | 'uiHints'>
): ToolArgumentValidationResult {
  const parameters = toolDef?.parameters;
  const properties = isRecord(parameters?.properties) ? parameters.properties : {};
  const aliasedArgs = coerceToolArgumentTypes(
    applyToolArgumentAliases(toolName, args, toolDef),
    properties
  );
  const required = Array.isArray(parameters?.required)
    ? (parameters.required as unknown[]).map(String)
    : [];
  const missingRequired = required.filter((key) => {
    const value = aliasedArgs[key];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  });
  const typeErrors = Object.entries(properties).flatMap(([key, schema]) => {
    const value = aliasedArgs[key];
    if (value === undefined || value === null) return [];
    return matchesSchemaType(value, schema)
      ? []
      : [`${key} 应为 ${(schema as any)?.type || '指定类型'}`];
  });

  return {
    ok: missingRequired.length === 0 && typeErrors.length === 0,
    args: aliasedArgs,
    missingRequired,
    typeErrors
  };
}

export function assertValidToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  toolDef?: Pick<ToolDefinition, 'parameters' | 'uiHints'>
): Record<string, unknown> {
  const result = validateToolArguments(toolName, args, toolDef);
  if (!result.ok) throw new ToolArgumentValidationError(toolName, result);
  return result.args;
}

export interface ToolObservationAssessment {
  success: boolean;
  status?: string;
  limited?: boolean;
  cached?: boolean;
  summary?: string;
  error?: string;
  reflectionInstruction?: string;
}

const NON_SUCCESS_TOOL_STATUSES = new Set([
  'limited',
  'invalid',
  'skipped',
  'error',
  'failed',
  'failure',
  'not_found',
  'blocked',
  'denied'
]);

export function assessToolObservationResult(
  result: unknown,
  options?: { toolName?: string }
): ToolObservationAssessment {
  const record = getToolResultRecord(result);
  const records = expandToolResultRecords(record);
  const status = firstStatus(records);
  const limited = records.some((candidate) => candidate.limited === true) || status === 'limited';
  const cached = records.some((candidate) => candidate.cached === true);
  const explicitFailure = records.some((candidate) => candidate.success === false);
  const foundFalse = records.some((candidate) => candidate.found === false);
  const hasErrors = records.some(
    (candidate) => Array.isArray(candidate.errors) && candidate.errors.length > 0
  );
  const nonSuccessStatus = !!status && NON_SUCCESS_TOOL_STATUSES.has(status);
  const success = !(explicitFailure || limited || foundFalse || nonSuccessStatus || hasErrors);
  const summary = pickToolResultText(records, ['summary', 'message', 'reason']);
  const error = success
    ? undefined
    : pickToolResultText(records, ['error', 'summary', 'message', 'reason']) ||
      (status ? `工具返回非成功状态：${status}` : '工具没有返回可直接使用的结果');
  const reflectionInstruction = createToolReflectionInstruction({
    success,
    status,
    limited,
    cached,
    foundFalse,
    summary,
    error
  });

  return {
    success,
    status,
    limited,
    cached,
    summary,
    error,
    reflectionInstruction
  };
}

function expandToolResultRecords(root: Record<string, unknown> | undefined): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    if (seen.has(record)) return;
    seen.add(record);
    records.push(record);

    for (const key of ['data', 'result', 'reactObservation', 'observation']) {
      visit(record[key]);
    }
  };

  visit(root);
  return records;
}

function firstStatus(records: Record<string, unknown>[]): string | undefined {
  let fallback: string | undefined;
  for (const record of records) {
    const status = normalizeStatus(record.status);
    if (!status) continue;
    if (NON_SUCCESS_TOOL_STATUSES.has(status)) return status;
    fallback ??= status;
  }
  return fallback;
}

function getToolResultRecord(result: unknown): Record<string, unknown> | undefined {
  if (isRecord(result)) return result;
  if (typeof result !== 'string') return undefined;
  const trimmed = result.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function applyToolObservationAssessment(
  content: string,
  assessment: ToolObservationAssessment
): string {
  if (!assessment.reflectionInstruction) return content;

  const reactObservation = {
    success: assessment.success,
    status: assessment.status,
    limited: assessment.limited === true ? true : undefined,
    cached: assessment.cached === true ? true : undefined,
    summary: assessment.summary,
    error: assessment.error,
    instruction: assessment.reflectionInstruction
  };
  const visibleAssessment = {
    success: assessment.success,
    status: assessment.status,
    limited: assessment.limited === true ? true : undefined,
    cached: assessment.cached === true ? true : undefined,
    reactObservation
  };

  try {
    const parsed = JSON.parse(content);
    if (isRecord(parsed)) {
      return JSON.stringify({ ...parsed, ...visibleAssessment, reactObservation });
    }
  } catch {
    // Keep non-JSON tool content displayable by wrapping it with explicit observation metadata.
  }

  return JSON.stringify({ result: content, ...visibleAssessment });
}

function normalizeStatus(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;
}

function pickToolResultText(
  records: Record<string, unknown>[],
  keys: string[]
): string | undefined {
  for (const source of records) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return undefined;
}

function createToolReflectionInstruction(input: {
  success: boolean;
  status?: string;
  limited?: boolean;
  cached?: boolean;
  foundFalse?: boolean;
  summary?: string;
  error?: string;
}): string | undefined {
  if (input.limited) {
    return '该工具调用已达到预算或策略上限。不要重试同一工具/参数；基于已有 observation 总结方案，信息不足时直接向用户提出澄清问题。';
  }
  if (input.cached) {
    return '这是缓存 observation。不要为了同一目标和参数重复调用同一工具；直接复用该结果继续推理。';
  }
  if (!input.success) {
    if (input.foundFalse || input.status === 'not_found') {
      return '该资源不存在或不可用。不要原样重试同一资源路径；请改查其他可见候选资源，或向用户澄清目标。';
    }
    return '工具没有返回可直接使用的结果。不要原样重试同一工具/参数；请换查询条件、选择其他路径，或向用户澄清缺失信息。';
  }
  return undefined;
}

export function createToolFailureSignature(toolName: string, args: unknown, error: string): string {
  const normalizedArgs = isRecord(args)
    ? Object.keys(args)
        .sort()
        .map((key) => [key, args[key]])
    : args;
  return JSON.stringify({ toolName, args: normalizedArgs, error });
}

export function getMaxRepeatedToolErrors(agentDef: AgentDefinition): number {
  const configured = agentDef.runtime?.maxRepeatedToolErrors;
  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  return 2;
}

export function shouldStopOnRepeatedToolError(agentDef: AgentDefinition): boolean {
  return agentDef.runtime?.stopOnRepeatedToolError !== false;
}
