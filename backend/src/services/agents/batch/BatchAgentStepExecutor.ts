import type { WorkflowStep } from '../../../types/agent.js';
import { parseJsonLenient } from '../../../utils/helpers.js';
import { LogService } from '../../LogService.js';
import type { ToolExecutionContext } from '../../ToolExecutionContext.js';
import type { AgentService } from '../AgentService.js';
import type { WorkflowProgressPayload } from '../WorkflowEngine.js';
import {
  deepClone,
  getByPath,
  renderTemplate,
  setByPath,
  truncateFields
} from '../workflowExpressions.js';
import {
  getBatchFailureKind,
  getBatchFailureOutput,
  getBatchFailurePolicy,
  getBatchMaxRetries,
  getBatchMinSize
} from './batchExecutionPolicy.js';
import type { BatchFailureKind } from './BatchOutputError.js';
import { parseJsonArrayBatchItems } from './batchOutputValidation.js';
import {
  chunkArray,
  formatBatchError,
  parseBatchInputItems,
  reindexBatchItems
} from './batchUtils.js';
import { buildBatchCorrectionMessages } from './correctionMessages.js';

type BatchExecutionConfig = NonNullable<WorkflowStep['execution']>;

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

/**
 * 把 WorkflowEngine 里"批处理 agent 步骤"的全部执行逻辑收敛到一个执行器：
 *  - 把 itemsPath 拿到的输入按 batchSize 切片；
 *  - 按 mergeStrategy（jsonArrayMerge / rawArray / markdownSectionMerge / textJoin）调度；
 *  - 每个 batch 经 `runBatchAgentWithRecovery` 包一层重试 / 拆分 / 自纠错；
 *  - 失败按 `getBatchFailurePolicy` 决定 retry / splitAndRetry / fail。
 *
 * 该类对 engine 状态只依赖 `agentService`，其它都是配置或 step 的纯派生，方便单测。
 */
export class BatchAgentStepExecutor {
  constructor(private readonly agentService: AgentService) {}

  async run(
    step: WorkflowStep,
    stepInput: unknown,
    date: string | undefined,
    emit: ((payload: WorkflowProgressPayload) => void) | undefined,
    agentRunContext?: { metadata?: Record<string, unknown>; toolContextExtras?: Partial<ToolExecutionContext> }
  ): Promise<unknown> {
    if (!step.agentId) {
      throw new Error(`Workflow step ${step.id} is batch agent step but has no agentId`);
    }
    const execution: BatchExecutionConfig = step.execution || {};
    const sourceItems = execution.itemsPath ? getByPath(stepInput, execution.itemsPath) : stepInput;
    const items = parseBatchInputItems(sourceItems, parseJsonLenient);
    const batchSize = Math.max(1, Math.min(100, Number(execution.batchSize || 10)));
    const batches = chunkArray(
      items.map((item) =>
        this.slimBatchItem(item, execution.itemFields, execution.itemFieldLimits)
      ),
      batchSize
    );
    const strategy = String(execution.mergeStrategy || 'jsonArrayMerge');

    if (strategy === 'rawArray' || strategy === 'markdownSectionMerge' || strategy === 'textJoin') {
      const contents: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        contents.push(
          await this.callBatchAgent(
            step,
            execution,
            stepInput,
            batches[i],
            { batchIndex: i + 1, batchCount: batches.length, attempt: 0, splitDepth: 0 },
            date,
            agentRunContext
          )
        );
      }
      if (strategy === 'rawArray') return contents;
      return contents
        .map((part) => part.trim())
        .filter(Boolean)
        .join('\n\n');
    }

    const merged: unknown[] = [];
    for (let i = 0; i < batches.length; i++) {
      this.emitStepProgress(
        emit,
        step,
        `批处理 ${i + 1}/${batches.length}（${batches[i].length} 条）`,
        { batchIndex: i + 1, batchCount: batches.length }
      );
      const batchItems = await this.runBatchAgentWithRecovery<unknown[]>(
        step,
        execution,
        stepInput,
        batches[i],
        { batchIndex: i + 1, batchCount: batches.length, splitDepth: 0 },
        date,
        (content, batch) => parseJsonArrayBatchItems(content, batch, execution),
        (left, right) => [...left, ...right],
        emit,
        agentRunContext
      );
      merged.push(...batchItems);
    }
    const outputItems = reindexBatchItems(merged, execution.reindexField);
    return { count: outputItems.length, items: outputItems };
  }

  private slimBatchItem(
    raw: Record<string, unknown>,
    fields?: string[],
    fieldLimits?: Record<string, number>
  ): Record<string, unknown> {
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

  private async callBatchAgent(
    step: WorkflowStep,
    execution: BatchExecutionConfig,
    stepInput: unknown,
    batch: Record<string, unknown>[],
    context: BatchAttemptContext,
    date?: string,
    agentRunContext?: { metadata?: Record<string, unknown>; toolContextExtras?: Partial<ToolExecutionContext> }
  ): Promise<string> {
    const batchScope = {
      input: execution.payloadFieldLimits
        ? truncateFields(deepClone(stepInput), execution.payloadFieldLimits)
        : stepInput,
      batch,
      batchIndex: context.batchIndex,
      batchCount: context.batchCount,
      batchSize: batch.length,
      retryAttempt: context.attempt,
      splitDepth: context.splitDepth
    };
    let payload =
      execution.inputTemplate !== undefined
        ? renderTemplate(execution.inputTemplate, batchScope)
        : {
            batchIndex: context.batchIndex,
            batchCount: context.batchCount,
            count: batch.length,
            items: batch
          };
    payload = deepClone(payload);
    if (execution.batchTargetPath && payload && typeof payload === 'object') {
      setByPath(payload, execution.batchTargetPath, batch);
    }
    const inputText = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const correctionMessages = context.feedback
      ? buildBatchCorrectionMessages(inputText, context.feedback, batch, execution)
      : undefined;
    const res = await this.agentService.runAgent(step.agentId!, inputText, date, {
      silent: true,
      noTools: step.agentOptions?.noTools,
      noSkills: step.agentOptions?.noSkills,
      runSource: 'workflow',
      metadata: {
        ...(agentRunContext?.metadata ?? {}),
        stepId: step.id,
        agentId: step.agentId
      },
      ...(agentRunContext?.toolContextExtras ? { toolContextExtras: agentRunContext.toolContextExtras } : {}),
      messages: correctionMessages
    });
    return res.content || '';
  }

  private async runBatchAgentWithRecovery<T>(
    step: WorkflowStep,
    execution: BatchExecutionConfig,
    stepInput: unknown,
    batch: Record<string, unknown>[],
    context: { batchIndex: number; batchCount: number; splitDepth: number },
    date: string | undefined,
    validate: (content: string, batch: Record<string, unknown>[]) => T,
    combineSplits: (left: T, right: T) => T,
    emit?: (payload: WorkflowProgressPayload) => void,
    agentRunContext?: { metadata?: Record<string, unknown>; toolContextExtras?: Partial<ToolExecutionContext> }
  ): Promise<T> {
    const maxRetries = getBatchMaxRetries(execution);
    let attempt = 0;
    let lastError: unknown;
    let feedback: BatchCorrectionFeedback | undefined;

    while (attempt <= maxRetries) {
      try {
        const content = await this.callBatchAgent(
          step,
          execution,
          stepInput,
          batch,
          { ...context, attempt, feedback },
          date,
          agentRunContext
        );
        return validate(content, batch);
      } catch (err) {
        lastError = err;
        const kind = getBatchFailureKind(err);
        const policy = getBatchFailurePolicy(execution, kind);
        const label = `${context.batchIndex}/${context.batchCount}`;
        if (policy !== 'fail' && attempt < maxRetries) {
          feedback = {
            kind,
            error: formatBatchError(err),
            previousOutput: getBatchFailureOutput(err)
          };
          LogService.warn(
            `[Workflow ${step.id}] Batch ${label} ${kind} validation failed; asking agent to self-correct attempt ${attempt + 1}/${maxRetries}: ${formatBatchError(err)}`
          );
          this.emitStepProgress(
            emit,
            step,
            `批 ${label} 解析失败，自纠错 ${attempt + 1}/${maxRetries}`,
            { batchIndex: context.batchIndex, batchCount: context.batchCount }
          );
          attempt += 1;
          continue;
        }
        if (policy === 'splitAndRetry' && batch.length > getBatchMinSize(execution)) {
          const mid = Math.ceil(batch.length / 2);
          const leftBatch = batch.slice(0, mid);
          const rightBatch = batch.slice(mid);
          LogService.warn(
            `[Workflow ${step.id}] Batch ${label} ${kind} validation failed; splitting ${batch.length} items into ${leftBatch.length}+${rightBatch.length}: ${formatBatchError(err)}`
          );
          this.emitStepProgress(
            emit,
            step,
            `批 ${label} 拆分为 ${leftBatch.length}+${rightBatch.length} 重试`,
            { batchIndex: context.batchIndex, batchCount: context.batchCount }
          );
          const left = await this.runBatchAgentWithRecovery(
            step,
            execution,
            stepInput,
            leftBatch,
            { ...context, splitDepth: context.splitDepth + 1 },
            date,
            validate,
            combineSplits,
            emit,
            agentRunContext
          );
          const right = await this.runBatchAgentWithRecovery(
            step,
            execution,
            stepInput,
            rightBatch,
            { ...context, splitDepth: context.splitDepth + 1 },
            date,
            validate,
            combineSplits,
            emit,
            agentRunContext
          );
          return combineSplits(left, right);
        }
        break;
      }
    }

    const kind = getBatchFailureKind(lastError);
    throw new Error(
      `Workflow step ${step.id} batch ${context.batchIndex}/${context.batchCount} failed ${kind} validation after ${maxRetries + 1} attempt(s): ${formatBatchError(lastError)}`
    );
  }

  private emitStepProgress(
    emit: ((payload: WorkflowProgressPayload) => void) | undefined,
    step: WorkflowStep,
    message: string,
    extra?: Partial<WorkflowProgressPayload>
  ): void {
    if (!emit) return;
    emit({
      type: 'step_progress',
      stepId: step.id,
      displayName: step.displayName || step.id,
      message,
      ...extra
    });
  }
}
