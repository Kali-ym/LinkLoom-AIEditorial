import { useMemo } from 'react';

type TokenizerEncoding = 'o200k_base' | 'cl100k_base' | 'p50k_base' | 'r50k_base';

export interface TokenEstimatorOptions {
  encoding?: TokenizerEncoding;
  driftMultiplier?: number;
}

export interface TokenEstimator {
  countText: (text: string) => number;
  countMessage: (message: { content?: unknown; role?: string }) => number;
}

const PER_MESSAGE_OVERHEAD = 4;
const IMAGE_TOKEN_ESTIMATE = 1500;

type EncodeFn = (text: string) => number[];

const encoderCache = new Map<TokenizerEncoding, EncodeFn>();

async function loadEncoder(encoding: TokenizerEncoding): Promise<EncodeFn> {
  const cached = encoderCache.get(encoding);
  if (cached) return cached;
  try {
    const mod = await import(`gpt-tokenizer/encoding/${encoding}`);
    const encode = (mod.encode ?? mod.default?.encode) as EncodeFn | undefined;
    if (typeof encode !== 'function') {
      throw new Error(`gpt-tokenizer encoding "${encoding}" did not export encode`);
    }
    const wrapped: EncodeFn = (text: string) => encode(text);
    encoderCache.set(encoding, wrapped);
    return wrapped;
  } catch {
    const fallback: EncodeFn = (text: string) => [Math.ceil(text.length / 4)];
    encoderCache.set(encoding, fallback);
    return fallback;
  }
}

function fallbackEstimate(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CreateTokenEstimatorResult extends TokenEstimator {
  preload: () => Promise<void>;
}

/**
 * 创建一个 token 估算器（纯函数版本，便于测试）。gpt-tokenizer 通过动态 import 懒加载。
 */
export function createTokenEstimator(options: TokenEstimatorOptions = {}): CreateTokenEstimatorResult {
  const encoding = options.encoding ?? 'o200k_base';
  const driftMultiplier = options.driftMultiplier ?? 1.15;
  let encoder: EncodeFn | null = null;
  let loadPromise: Promise<void> | null = null;

  function ensureEncoder(): Promise<void> {
    if (encoder) return Promise.resolve();
    if (!loadPromise) {
      loadPromise = loadEncoder(encoding).then((fn) => {
        encoder = fn;
      });
    }
    return loadPromise;
  }

  function countText(text: string): number {
    if (!text) return 0;
    const raw = encoder ? encoder(text).length : fallbackEstimate(text);
    return Math.ceil(raw * driftMultiplier);
  }

  function countMessage(message: { content?: unknown; role?: string }): number {
    let tokens = 0;
    const content = message.content;
    if (typeof content === 'string') {
      tokens += countText(content);
    } else if (Array.isArray(content)) {
      for (const part of content as Array<{ type?: string; text?: string; image_url?: unknown }>) {
        if (part.type === 'text') tokens += countText(part.text ?? '');
        else if (part.type === 'image_url') tokens += IMAGE_TOKEN_ESTIMATE;
      }
    }
    return tokens + PER_MESSAGE_OVERHEAD;
  }

  void ensureEncoder();

  return {
    countText,
    countMessage,
    preload: ensureEncoder
  };
}

/**
 * React hook 版本：在组件中使用，memoize 估算器实例。
 */
export function useTokenEstimator(options: TokenEstimatorOptions = {}): TokenEstimator {
  const { encoding, driftMultiplier } = options;
  return useMemo(() => {
    const est = createTokenEstimator({ encoding, driftMultiplier });
    return { countText: est.countText, countMessage: est.countMessage };
  }, [encoding, driftMultiplier]);
}
