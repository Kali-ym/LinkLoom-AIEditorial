import { extractJson, parseJsonLenient } from '../../../shared/json.js';
import { BatchOutputError } from './BatchOutputError.js';

/**
 * 把 LLM 输出的 batch 结果解析为对象数组。
 *
 * 行为：
 * - 优先 `extractJson`（容错正则提取），否则走 `parseJsonLenient`。
 * - 接受 JSON 数组或 `{ items: [...] }` 形态；`batch.length === 1` 时允许单对象。
 * - `validateItemCount=true` 时，输出条目数必须与输入 batch 数匹配，否则抛 `BatchOutputError('count')`。
 */
export function parseJsonArrayBatchItems(
  content: string,
  batch: Record<string, unknown>[],
  validateItemCount: boolean
): unknown[] {
  let parsed: unknown;
  try {
    const extracted = extractJson(content);
    parsed = extracted ?? parseJsonLenient(content);
  } catch (err) {
    throw new BatchOutputError(
      'parse',
      `batch output is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      err,
      content
    );
  }

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

  if (validateItemCount && parsedItems.length !== batch.length) {
    throw new BatchOutputError(
      'count',
      `batch item count mismatch: expected ${batch.length}, got ${parsedItems.length}`,
      undefined,
      content
    );
  }

  return parsedItems;
}
