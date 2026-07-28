import {
  BatchOutputError,
  type BatchFailureKind
} from '../../../services/agents/batch/BatchOutputError.js';
import { parseJsonArrayBatchItems } from '../../../services/agents/batch/parseBatchItems.js';
import {
  getFailurePolicy,
  getMaxRetries,
  getMinBatchSize,
  type BatchFailurePolicy
} from '../../../services/agents/batch/policy.js';
import {
  deepClone,
  getByPath,
  renderTemplate,
  setByPath,
  truncateFields
} from '../../../services/agents/workflowExpressions.js';
import { LogService } from '../../../services/LogService.js';
import type { ServiceContext } from '../../../services/ServiceContext.js';
import { requireToolContext } from '../../../services/ToolExecutionContext.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { parseJsonLenient } from '../../../shared/json.js';
import type { AIMessage } from '../../../types/index.js';
import { BaseTool } from '../../base/BaseTool.js';

type BatchAttemptContext = {
  batchIndex: number;
  batchCount: number;
  attempt: number;
  splitDepth: number;
  feedback?: BatchCorrectionFeedback;
};

interface BatchCorrectionFeedback {
  kind: BatchFailureKind;
  error: string;
  previousOutput: string;
}

function parseItems(input: unknown): Record<string, unknown>[] {
  if (typeof input === 'string') {
    const parsed = parseJsonLenient(input);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { items?: unknown[] }).items)
    ) {
      return (parsed as { items: Record<string, unknown>[] }).items;
    }
    throw new Error('input must be an array, { items }, or JSON string');
  }
  if (Array.isArray(input)) return input as Record<string, unknown>[];
  if (input && typeof input === 'object' && Array.isArray((input as { items?: unknown[] }).items)) {
    return (input as { items: Record<string, unknown>[] }).items;
  }
  throw new Error('input must be an array or { items }');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function slimObject(
  raw: Record<string, unknown>,
  fields?: string[],
  fieldLimits?: Record<string, number>
) {
  const item: Record<string, unknown> = {};
  if (fields?.length) {
    for (const field of fields) {
      setByPath(item, field, getByPath(raw, field));
    }
  } else {
    Object.assign(item, raw);
  }
  return truncateFields(item, fieldLimits || {}) as Record<string, unknown>;
}

function getFailureKind(err: unknown): BatchFailureKind {
  if (err instanceof BatchOutputError) return err.kind;
  return 'parse';
}

function getFailureOutput(err: unknown): string {
  if (err instanceof BatchOutputError) return err.output || '';
  return '';
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function buildCorrectionMessages(
  originalInput: string,
  feedback: BatchCorrectionFeedback,
  batch: Record<string, unknown>[],
  mergeStrategy?: string
): AIMessage[] {
  const requiredIds = batch.map((item, index) => ({
    position: index + 1,
    index: item.index,
    id: item.id,
    topic_id: item.topic_id,
    title: item.title ?? item.headline
  }));
  void mergeStrategy;
  const expectedShape =
    'Return only one complete valid JSON object in the form {"items":[...]} or a JSON array.';
  return [
    { role: 'user', content: originalInput },
    { role: 'assistant', content: feedback.previousOutput || '' },
    {
      role: 'user',
      content: [
        'The previous response failed deterministic batch validation.',
        `Failure type: ${feedback.kind}`,
        `Validation error: ${feedback.error}`,
        `Expected input item count: ${batch.length}`,
        `Required item identifiers, in order: ${JSON.stringify(requiredIds)}`,
        expectedShape,
        'Do not summarize the problem. Do not omit any input item. Do not add markdown fences.',
        'Correct only the output format/content and return the full replacement JSON now.'
      ].join('\n')
    }
  ];
}

export class BatchAgentRunnerTool extends BaseTool {
  readonly id = 'batch_agent_runner';
  readonly name = 'batch_agent_runner';
  readonly displayName = '分批执行';
  readonly scope = 'system' as const;
  readonly description =
    '将数组数据按 batchSize 分批调用指定 Agent 处理，并按 mergeStrategy 合并各批输出。' +
    '适用于大批量素材需分段处理的系统/工作流场景。必填：agentId、input（数组、{ items } 或 JSON 字符串）。';
  readonly parameters = {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'Agent ID to execute' },
      input: { description: 'Array, { items }, or JSON string to batch' },
      items: { description: 'Alias for input' },
      batchSize: { type: 'number', description: 'Items per batch, default 10' },
      date: { type: 'string', description: 'Optional execution date' },
      mergeStrategy: {
        type: 'string',
        enum: ['jsonArrayMerge', 'markdownSectionMerge', 'textJoin', 'rawArray'],
        description: 'How batch outputs are merged'
      },
      itemFields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional field allowlist for each item'
      },
      itemFieldLimits: {
        type: 'object',
        description: 'Optional per-item string field truncation limits by field path'
      },
      payloadFieldLimits: {
        type: 'object',
        description: 'Optional per-payload string field truncation limits by field path'
      },
      itemsPath: {
        type: 'string',
        description: 'Optional path inside input to batch, e.g. $.topics'
      },
      batchTargetPath: {
        type: 'string',
        description: 'Optional path inside each batch payload to replace with current batch'
      },
      inputTemplate: {
        description:
          'Optional JSON template for each batch. {{batch}}, {{batchIndex}}, {{batchCount}} are available as strings.'
      },
      onBatchParseError: { type: 'string', enum: ['fail', 'retry', 'splitAndRetry'] },
      onBatchItemCountMismatch: { type: 'string', enum: ['fail', 'retry', 'splitAndRetry'] },
      maxBatchRetries: { type: 'number', description: 'Retries before split/fail, default 1' },
      minBatchSize: { type: 'number', description: 'Smallest batch size to split to, default 1' },
      validateBatchItemCount: {
        type: 'boolean',
        description: 'Require jsonArrayMerge outputs to match input batch count, default true'
      },
      noTools: { type: 'boolean' },
      noSkills: { type: 'boolean' },
      stepLabel: { type: 'string' }
    },
    required: ['agentId']
  };

  async handler(
    args: {
      agentId: string;
      input?: unknown;
      items?: unknown;
      batchSize?: number;
      date?: string;
      mergeStrategy?: 'jsonArrayMerge' | 'markdownSectionMerge' | 'textJoin' | 'rawArray';
      itemFields?: string[];
      itemFieldLimits?: Record<string, number>;
      payloadFieldLimits?: Record<string, number>;
      itemsPath?: string;
      batchTargetPath?: string;
      inputTemplate?: unknown;
      onBatchParseError?: 'fail' | 'retry' | 'splitAndRetry';
      onBatchItemCountMismatch?: 'fail' | 'retry' | 'splitAndRetry';
      maxBatchRetries?: number;
      minBatchSize?: number;
      validateBatchItemCount?: boolean;
      noTools?: boolean;
      noSkills?: boolean;
      stepLabel?: string;
    },
    _toolCtx?: ToolExecutionContext
  ) {
    if (!args.agentId?.trim()) throw new Error('agentId is required');
    const baseInput = args.input ?? args.items;
    const sourceItems = args.itemsPath ? getByPath(baseInput, args.itemsPath) : baseInput;
    const items = parseItems(sourceItems);
    const batchSize = Math.max(1, Math.min(100, args.batchSize ?? 10));
    const batches = chunkArray(
      items.map((item) => slimObject(item, args.itemFields, args.itemFieldLimits)),
      batchSize
    );
    const ctx = requireToolContext(_toolCtx, this.id).services;
    if (!ctx.agentService) throw new Error('AgentService is not initialized');

    const strategy = args.mergeStrategy || 'textJoin';
    let content: string;
    let data: unknown;
    if (strategy === 'rawArray') {
      const contents: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        contents.push(
          await this.callAgent(ctx.agentService, args, baseInput, batches[i], {
            batchIndex: i + 1,
            batchCount: batches.length,
            attempt: 0,
            splitDepth: 0
          })
        );
      }
      data = contents;
      content = JSON.stringify(data);
    } else if (strategy === 'jsonArrayMerge') {
      const merged: unknown[] = [];
      for (let i = 0; i < batches.length; i++) {
        const batchItems = await this.runWithRecovery<unknown[]>(
          ctx.agentService,
          args,
          baseInput,
          batches[i],
          { batchIndex: i + 1, batchCount: batches.length, splitDepth: 0 },
          (part, batch) =>
            parseJsonArrayBatchItems(part, batch, args.validateBatchItemCount !== false),
          (left, right) => [...left, ...right]
        );
        merged.push(...batchItems);
      }
      data = { count: merged.length, items: merged };
      content = JSON.stringify(data);
    } else if (strategy === 'markdownSectionMerge') {
      const contents: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        contents.push(
          await this.callAgent(ctx.agentService, args, baseInput, batches[i], {
            batchIndex: i + 1,
            batchCount: batches.length,
            attempt: 0,
            splitDepth: 0
          })
        );
      }
      data = contents
        .map((part) => part.trim())
        .filter(Boolean)
        .join('\n\n');
      content = String(data);
    } else {
      const contents: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        contents.push(
          await this.callAgent(ctx.agentService, args, baseInput, batches[i], {
            batchIndex: i + 1,
            batchCount: batches.length,
            attempt: 0,
            splitDepth: 0
          })
        );
      }
      data = contents.join('\n\n');
      content = String(data);
    }

    return {
      success: true,
      agentId: args.agentId,
      batchCount: batches.length,
      content,
      data,
      contentLength: content.length,
      message: `${args.stepLabel || args.agentId}: ran ${batches.length} batches`
    };
  }

  private async callAgent(
    agentService: NonNullable<ServiceContext['agentService']>,
    args: {
      agentId: string;
      inputTemplate?: unknown;
      batchTargetPath?: string;
      date?: string;
      noTools?: boolean;
      noSkills?: boolean;
      mergeStrategy?: string;
      payloadFieldLimits?: Record<string, number>;
    },
    baseInput: unknown,
    batch: Record<string, unknown>[],
    context: BatchAttemptContext
  ): Promise<string> {
    const batchScope = {
      input: args.payloadFieldLimits
        ? truncateFields(deepClone(baseInput), args.payloadFieldLimits)
        : baseInput,
      batch,
      batchIndex: context.batchIndex,
      batchCount: context.batchCount,
      batchSize: batch.length,
      retryAttempt: context.attempt,
      splitDepth: context.splitDepth
    };
    let payload =
      args.inputTemplate !== undefined
        ? renderTemplate(args.inputTemplate, batchScope)
        : {
            batchIndex: context.batchIndex,
            batchCount: context.batchCount,
            count: batch.length,
            items: batch
          };
    payload = deepClone(payload);
    if (args.batchTargetPath && payload && typeof payload === 'object') {
      setByPath(payload, args.batchTargetPath, batch);
    }
    const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const messages = context.feedback
      ? buildCorrectionMessages(input, context.feedback, batch, args.mergeStrategy)
      : undefined;
    const res = await agentService.runAgent(args.agentId, input, args.date, {
      silent: true,
      noTools: args.noTools,
      noSkills: args.noSkills,
      messages
    });
    return res.content || '';
  }

  private async runWithRecovery<T>(
    agentService: NonNullable<ServiceContext['agentService']>,
    args: {
      agentId: string;
      inputTemplate?: unknown;
      batchTargetPath?: string;
      date?: string;
      noTools?: boolean;
      noSkills?: boolean;
      stepLabel?: string;
      onBatchParseError?: 'fail' | 'retry' | 'splitAndRetry';
      onBatchItemCountMismatch?: 'fail' | 'retry' | 'splitAndRetry';
      maxBatchRetries?: number;
      minBatchSize?: number;
    },
    baseInput: unknown,
    batch: Record<string, unknown>[],
    context: { batchIndex: number; batchCount: number; splitDepth: number },
    validate: (content: string, batch: Record<string, unknown>[]) => T,
    combineSplits: (left: T, right: T) => T
  ): Promise<T> {
    const maxRetries = getMaxRetries(args.maxBatchRetries);
    let attempt = 0;
    let lastError: unknown;
    let feedback: BatchCorrectionFeedback | undefined;

    while (attempt <= maxRetries) {
      try {
        const content = await this.callAgent(agentService, args, baseInput, batch, {
          ...context,
          attempt,
          feedback
        });
        return validate(content, batch);
      } catch (err) {
        lastError = err;
        const kind = getFailureKind(err);
        const rawPolicy = kind === 'count' ? args.onBatchItemCountMismatch : args.onBatchParseError;
        const policy = getFailurePolicy(rawPolicy);
        const label = `${context.batchIndex}/${context.batchCount}`;
        if (policy !== 'fail' && attempt < maxRetries) {
          feedback = {
            kind,
            error: formatError(err),
            previousOutput: getFailureOutput(err)
          };
          LogService.warn(
            `[${args.stepLabel || args.agentId}] Batch ${label} ${kind} validation failed; asking agent to self-correct attempt ${attempt + 1}/${maxRetries}: ${formatError(err)}`
          );
          attempt += 1;
          continue;
        }
        if (policy === 'splitAndRetry' && batch.length > getMinBatchSize(args.minBatchSize)) {
          const mid = Math.ceil(batch.length / 2);
          const leftBatch = batch.slice(0, mid);
          const rightBatch = batch.slice(mid);
          LogService.warn(
            `[${args.stepLabel || args.agentId}] Batch ${label} ${kind} validation failed; splitting ${batch.length} items into ${leftBatch.length}+${rightBatch.length}: ${formatError(err)}`
          );
          const left = await this.runWithRecovery(
            agentService,
            args,
            baseInput,
            leftBatch,
            { ...context, splitDepth: context.splitDepth + 1 },
            validate,
            combineSplits
          );
          const right = await this.runWithRecovery(
            agentService,
            args,
            baseInput,
            rightBatch,
            { ...context, splitDepth: context.splitDepth + 1 },
            validate,
            combineSplits
          );
          return combineSplits(left, right);
        }
        break;
      }
    }

    const kind = getFailureKind(lastError);
    throw new Error(
      `${args.stepLabel || args.agentId} batch ${context.batchIndex}/${context.batchCount} failed ${kind} validation after ${maxRetries + 1} attempt(s): ${formatError(lastError)}`
    );
  }
}
