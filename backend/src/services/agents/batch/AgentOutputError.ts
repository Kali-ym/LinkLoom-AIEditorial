/**
 * Workflow batch / single-agent 步骤的输出验证错误。
 *
 * 拆出原因：原本嵌在 `WorkflowEngine.ts` 头部 ~15 行；这里独立放出，方便 batch 子目录
 * 的 helper 也能 `instanceof` 判断（避免循环依赖 WorkflowEngine）。
 */
export type AgentValidationKind = 'parse' | 'coverage';

export class AgentOutputError extends Error {
  readonly kind: AgentValidationKind;
  readonly output?: string;

  constructor(kind: AgentValidationKind, message: string, cause?: unknown, output?: string) {
    super(message);
    this.name = 'AgentOutputError';
    this.kind = kind;
    this.output = output;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
