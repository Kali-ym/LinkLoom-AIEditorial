/**
 * Batch 执行场景的输出错误，包含失败类型（解析 / 数量校验）和原始输出。
 *
 * 由 `WorkflowEngine` 与 `BatchAgentRunnerTool` 共同使用，
 * 之前两侧各维护一份近似实现，统一到这里避免漂移。
 */
export type BatchFailureKind = 'parse' | 'count';

export class BatchOutputError extends Error {
  readonly kind: BatchFailureKind;
  readonly output?: string;

  constructor(kind: BatchFailureKind, message: string, cause?: unknown, output?: string) {
    super(message);
    this.name = 'BatchOutputError';
    this.kind = kind;
    this.output = output;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
