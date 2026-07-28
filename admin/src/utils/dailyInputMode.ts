/** Admin 预览：与 backend dailyInputMode 保持一致的展示逻辑 */

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function isDescriptionDuplicateOfAiSummary(
  description: unknown,
  aiSummary: unknown
): boolean {
  const d = pickString(description);
  const s = pickString(aiSummary);
  if (!d || !s) return false;
  if (d === s) return true;
  if (s.includes(d) && d.length >= 40) return true;
  if (d.includes(s) && s.length >= 40) return true;
  return false;
}

/** 取应展示的「原始描述」：排除与 AI 总结重复的 description */
export function resolveRawDescription(item: {
  description?: unknown;
  metadata?: Record<string, unknown>;
}): string {
  const aiSummary = pickString(item.metadata?.ai_summary);
  const translated = pickString(item.metadata?.translated_description);
  const raw = pickString(item.description);
  if (translated && !isDescriptionDuplicateOfAiSummary(translated, aiSummary)) return translated;
  if (raw && !isDescriptionDuplicateOfAiSummary(raw, aiSummary)) return raw;
  return '';
}

/** 列表卡片一行摘要：优先 AI 短摘要，否则 AI 总结，否则非重复原文描述 */
export function resolveItemSnippet(item: {
  description?: unknown;
  metadata?: Record<string, unknown>;
}): string {
  const short = pickString(item.metadata?.ai_summary_short);
  if (short) return short;
  const aiSummary = pickString(item.metadata?.ai_summary);
  if (aiSummary) return aiSummary;
  return resolveRawDescription(item);
}
