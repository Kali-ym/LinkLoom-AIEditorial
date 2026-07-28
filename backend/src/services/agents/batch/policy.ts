/**
 * Batch 失败处理策略与重试上限工具函数。共享给 WorkflowEngine 与 BatchAgentRunnerTool。
 */
export type BatchFailurePolicy = 'fail' | 'retry' | 'splitAndRetry';

export function getFailurePolicy(policy: string | undefined): BatchFailurePolicy {
  if (policy === 'retry' || policy === 'splitAndRetry' || policy === 'fail') return policy;
  return 'fail';
}

export function getMaxRetries(value: unknown): number {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(5, Math.floor(n)));
}

export function getMinBatchSize(value: unknown): number {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, Math.floor(n)));
}
