const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-sonnet-4': 200_000,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
};

const DEFAULT_CONTEXT_WINDOW = 200_000;

export function useContextWindowTokens(model: string, _provider: string): number {
  if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model];
  const normalized = model.toLowerCase();
  if (normalized.includes('gemini')) return 1_000_000;
  if (normalized.includes('claude')) return 200_000;
  if (normalized.includes('glm')) return 128_000;
  if (normalized.includes('gpt')) return 128_000;
  return DEFAULT_CONTEXT_WINDOW;
}

/**
 * @deprecated 优先使用 useTokenEstimator 的 gpt-tokenizer 计数。
 * 此函数仅作为 gpt-tokenizer 未加载完成时的 fallback。
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(value));
}
