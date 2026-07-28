import type { WorkflowStep } from '../../../types/agent.js';
import { extractJson, parseJsonLenient } from '../../../utils/helpers.js';
import { getByPath } from '../workflowExpressions.js';
import { AgentOutputError } from './AgentOutputError.js';
import { BatchOutputError } from './BatchOutputError.js';
import { formatBatchError, parseBatchInputItems } from './batchUtils.js';

type BatchExecutionConfig = NonNullable<WorkflowStep['execution']>;

/**
 * Agent batch / 单 agent 步骤输出的 JSON 解析与覆盖度断言。
 *
 * 这一组函数原本以 private method 形态嵌在 WorkflowEngine，但都不依赖任何实例状态，
 * 单独抽出便于单测与下一步迁到 `BatchAgentStepExecutor`。
 */

/** 把 agent 输出按 JSON 严格 + 宽松两次解析，失败统一抛 `BatchOutputError('parse')`。 */
export function parseBatchJsonContent(content: string): unknown {
  try {
    const extracted = extractJson(content);
    if (extracted) return extracted;
    return parseJsonLenient(content);
  } catch (err) {
    throw new BatchOutputError(
      'parse',
      `batch output is not valid JSON: ${formatBatchError(err)}`,
      err,
      content
    );
  }
}

/**
 * 解析 batch agent 输出为条目数组，并校验条目数量与输入是否一致。
 * - 兼容 `[]` / `{items:[]}` / 单对象包裹（仅 batch=1 时）三种形态。
 * - 若 `validateBatchItemCount=false` 则放过数量不一致。
 */
export function parseJsonArrayBatchItems(
  content: string,
  batch: Record<string, unknown>[],
  execution: BatchExecutionConfig
): unknown[] {
  const parsed = parseBatchJsonContent(content);
  const parsedItems = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown[] }).items)
      ? (parsed as { items: unknown[] }).items
      : undefined;
  if (!parsedItems) {
    if (batch.length === 1 && parsed && typeof parsed === 'object') return [parsed];
    throw new BatchOutputError(
      'parse',
      'batch output must be a JSON array or an object with an items array',
      undefined,
      content
    );
  }
  if (execution.validateBatchItemCount !== false && parsedItems.length !== batch.length) {
    throw new BatchOutputError(
      'count',
      `batch item count mismatch: expected ${batch.length}, got ${parsedItems.length}`,
      undefined,
      content
    );
  }
  return parsedItems;
}

/** 根据 step.execution.validateCoverage 计算需要覆盖的原始 input items。 */
export function resolveCoverageItems(
  stepInput: unknown,
  execution: BatchExecutionConfig
): Record<string, unknown>[] {
  const source = execution.validateCoverage?.inputItemsPath
    ? getByPath(stepInput, execution.validateCoverage.inputItemsPath)
    : stepInput;
  return parseBatchInputItems(source, parseJsonLenient);
}

/**
 * 在 agent 输出对象上断言对每个输入 item 的覆盖：
 * - 必须每个 idField 都被 source_items 引用 1 次；
 * - 多/缺/未知都会抛 `AgentOutputError('coverage')`。
 */
export function assertOutputCoversItems(
  outputObject: Record<string, unknown>,
  inputItems: Record<string, unknown>[],
  execution: BatchExecutionConfig,
  output: string
): void {
  const config = execution.validateCoverage || {};
  const collections = config.outputCollections?.length ? config.outputCollections : ['items'];
  const sourceItemsField = config.sourceItemsField || 'source_items';
  const idField = config.idField || 'index';

  const expected = new Set<number>();
  for (const item of inputItems) {
    const idx = Number(item[idField]);
    if (Number.isFinite(idx) && idx > 0) expected.add(idx);
  }
  const seen = new Map<number, number>();
  const scan = (records: unknown[]) => {
    for (const record of records) {
      const sourceItems =
        record && typeof record === 'object'
          ? (record as Record<string, unknown>)[sourceItemsField]
          : undefined;
      if (!Array.isArray(sourceItems)) continue;
      for (const source of sourceItems) {
        const idx =
          typeof source === 'number'
            ? source
            : Number((source as Record<string, unknown>)?.[idField]);
        if (Number.isFinite(idx) && idx > 0) seen.set(idx, (seen.get(idx) || 0) + 1);
      }
    }
  };
  for (const collectionPath of collections) {
    const collection = getByPath(outputObject, collectionPath);
    if (!Array.isArray(collection)) {
      throw new AgentOutputError(
        'coverage',
        `coverage collection must be an array: ${collectionPath}`,
        undefined,
        output
      );
    }
    scan(collection);
  }

  const missing = [...expected].filter((idx) => !seen.has(idx));
  const unknown = [...seen.keys()].filter((idx) => !expected.has(idx));
  const duplicate = [...seen.entries()].filter(([, count]) => count > 1).map(([idx]) => idx);
  const errors: string[] = [];
  if (missing.length) errors.push(`missing indices: ${missing.join(',')}`);
  if (duplicate.length) errors.push(`duplicate indices: ${duplicate.join(',')}`);
  if (unknown.length) errors.push(`unknown indices: ${unknown.join(',')}`);
  if (errors.length) {
    throw new AgentOutputError(
      'coverage',
      `coverage mismatch (${errors.join('; ')})`,
      undefined,
      output
    );
  }
}

/**
 * 单 agent 步骤（非 batch）输出校验入口：根据 execution.validateJsonObject /
 * validateCoverage 选择验证策略，失败抛 `AgentOutputError`。
 */
export function validateSingleAgentOutput(
  step: WorkflowStep,
  content: string,
  stepInput: unknown
): void {
  const execution = step.execution || {};
  if (!execution.validateJsonObject && !execution.validateCoverage) return;

  let parsed: unknown;
  try {
    parsed = parseBatchJsonContent(content);
  } catch (err) {
    throw new AgentOutputError('parse', formatBatchError(err), err, content);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AgentOutputError('parse', 'agent output must be a JSON object', undefined, content);
  }
  if (execution.validateCoverage) {
    const coverageItems = resolveCoverageItems(stepInput, execution);
    assertOutputCoversItems(parsed as Record<string, unknown>, coverageItems, execution, content);
  }
}
