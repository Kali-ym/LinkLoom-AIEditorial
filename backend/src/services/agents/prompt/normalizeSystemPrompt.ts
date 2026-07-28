import type { StructuredPrompt } from './types.js';

/**
 * 把 systemPrompt（字符串或结构化对象）统一桥接成 StructuredPrompt。
 * 旧字符串自动包成 { identity }，新结构化对象原样返回。
 */
export function normalizeSystemPrompt(
  raw: string | StructuredPrompt | undefined
): StructuredPrompt {
  if (!raw) return {};
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? { identity: trimmed } : {};
  }
  return raw;
}
