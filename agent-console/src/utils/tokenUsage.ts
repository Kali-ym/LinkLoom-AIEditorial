import type { ContextBreakdown } from '../domain/types/contextUsage';

export type TokenUsageSnapshot = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  breakdown?: ContextBreakdown;
};

export function extractTokenUsage(usage: unknown): TokenUsageSnapshot {
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const record = usage as Record<string, unknown>;
  const promptTokens =
    Number(record.prompt_tokens ?? record.promptTokens ?? record.input_tokens ?? 0) || 0;
  const completionTokens =
    Number(record.completion_tokens ?? record.completionTokens ?? record.output_tokens ?? 0) || 0;
  const totalTokens =
    Number(record.total_tokens ?? record.totalTokens ?? promptTokens + completionTokens) || 0;
  const breakdown = typeof record.breakdown === 'object' && record.breakdown
    ? (record.breakdown as ContextBreakdown)
    : undefined;
  return { promptTokens, completionTokens, totalTokens, breakdown };
}
