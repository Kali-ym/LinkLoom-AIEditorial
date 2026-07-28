import type { WorkflowStep } from '../../../types/agent.js';
import { AgentOutputError, type AgentValidationKind } from './AgentOutputError.js';
import { BatchOutputError, type BatchFailureKind } from './BatchOutputError.js';
import type { BatchFailurePolicy } from './policy.js';

type BatchExecutionConfig = NonNullable<WorkflowStep['execution']>;

/**
 * 工作流 batch / single-agent 步骤的策略读取与失败分类。
 *
 * 这一组函数原本散在 WorkflowEngine 1000-1100 行；它们对 engine 状态完全无依赖，
 * 抽出后既方便单测，也方便后续 `BatchAgentStepExecutor` 复用。
 */

export function getAgentMaxRetries(execution: BatchExecutionConfig | undefined): number {
  const n = Number(execution?.maxAgentRetries ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(5, Math.floor(n)));
}

export function getAgentFailureKind(err: unknown): AgentValidationKind {
  if (err instanceof AgentOutputError) return err.kind;
  return 'parse';
}

export function getAgentFailureOutput(err: unknown): string {
  if (err instanceof AgentOutputError) return err.output || '';
  return '';
}

export function getBatchMaxRetries(execution: BatchExecutionConfig): number {
  const n = Number(execution.maxBatchRetries ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(5, Math.floor(n)));
}

export function getBatchMinSize(execution: BatchExecutionConfig): number {
  const n = Number(execution.minBatchSize ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

/** 把配置里声明的策略字符串映射为本系统支持的枚举之一。 */
export function getBatchFailurePolicy(
  execution: BatchExecutionConfig,
  kind: BatchFailureKind
): BatchFailurePolicy {
  const raw = (
    kind === 'count' ? execution.onBatchItemCountMismatch : execution.onBatchParseError
  ) as string | undefined;
  if (raw === 'retry' || raw === 'splitAndRetry' || raw === 'fail') return raw;
  return 'fail';
}

export function getBatchFailureKind(err: unknown): BatchFailureKind {
  if (err instanceof BatchOutputError) return err.kind;
  return 'parse';
}

export function getBatchFailureOutput(err: unknown): string {
  if (err instanceof BatchOutputError) return err.output || '';
  return '';
}
