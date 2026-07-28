/**
 * Workflow batch 步骤共用纯工具。
 *
 * 这些函数完全无状态，只接受输入返回输出，独立出来便于单测、
 * 也避免 `WorkflowEngine.ts` 继续膨胀。
 */

/** 数组分块。 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 合并去重后的 batch 输出条目，按 1-based 顺序写回 reindexField。 */
export function reindexBatchItems(items: unknown[], field?: string): unknown[] {
  const key = field;
  if (!key) return items;
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return { ...(item as Record<string, unknown>), [key]: index + 1 };
  });
}

/** 把错误对象格式化为字符串（保留 message 优先）。 */
export function formatBatchError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * 把过长的失败输出做"中间省略"压缩，避免给下一轮自纠错塞太多 token。
 * 默认上限 ~2400 字符，截断时保留首尾两半。
 */
export function compactFailureOutput(output: string, maxChars = 2400): string {
  if (!output || output.length <= maxChars) return output || '';
  const half = Math.floor((maxChars - 120) / 2);
  return [
    output.slice(0, half),
    `\n\n...[previous output truncated: ${output.length} chars total]...\n\n`,
    output.slice(-half)
  ].join('');
}

/**
 * 把 batch 步骤的输入归一化为 `Record[]`，兼容 JSON 字符串 / 数组 / `{ items: [] }` 三种形式。
 * 旧实现散在 WorkflowEngine 与 BatchAgentRunnerTool 两处，统一到这里避免分叉。
 */
export function parseBatchInputItems(
  input: unknown,
  parseJson: (text: string) => unknown
): Record<string, unknown>[] {
  if (typeof input === 'string') {
    const parsed = parseJson(input);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { items?: unknown[] }).items)
    ) {
      return (parsed as { items: Record<string, unknown>[] }).items;
    }
    throw new Error('batch input must be an array, { items }, or JSON string');
  }
  if (Array.isArray(input)) return input as Record<string, unknown>[];
  if (input && typeof input === 'object' && Array.isArray((input as { items?: unknown[] }).items)) {
    return (input as { items: Record<string, unknown>[] }).items;
  }
  throw new Error('batch input must be an array or { items }');
}

/**
 * 把 prepared input（步骤已结构化）与 step 输出（可能是裸数组、字符串、对象）合并：
 * 仅在两边都是非数组 object 时才用 spread，否则保留 output。
 */
export function mergePreparedWithStepOutput(preparedInput: unknown, stepOutput: unknown): unknown {
  const prepared =
    preparedInput && typeof preparedInput === 'object' && !Array.isArray(preparedInput)
      ? (preparedInput as Record<string, unknown>)
      : {};
  const output =
    stepOutput && typeof stepOutput === 'object' && !Array.isArray(stepOutput)
      ? (stepOutput as Record<string, unknown>)
      : {};
  return { ...prepared, ...output };
}

/**
 * 把传给 tool 的 step 输入标准化为对象。
 * - 已经是对象（非数组）→ shallow copy；
 * - 是数组或原始值 → 包成 `{ items, input }` 双关键字（与既有 Tool 约定一致）。
 */
export function buildToolInput(stepInput: unknown): Record<string, unknown> {
  if (stepInput && typeof stepInput === 'object' && !Array.isArray(stepInput)) {
    return { ...(stepInput as Record<string, unknown>) };
  }
  if (stepInput !== undefined) {
    return { items: stepInput, input: stepInput };
  }
  return {};
}
