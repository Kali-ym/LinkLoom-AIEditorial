import type { TokenizerEncoding } from './ModelContextProfile.js';
import type { AIMessage } from '../../../types/index.js';

export interface TokenEstimatorOptions {
  encoding?: TokenizerEncoding;
  driftMultiplier?: number;
}

const IMAGE_TOKEN_ESTIMATE = 1500;
const PER_MESSAGE_OVERHEAD = 4;
const PER_TOOL_CALL_OVERHEAD = 5;

type EncodeFn = (text: string) => number[];

const encoderCache = new Map<TokenizerEncoding, EncodeFn>();

async function loadEncoder(encoding: TokenizerEncoding): Promise<EncodeFn> {
  const cached = encoderCache.get(encoding);
  if (cached) return cached;
  const mod = await import(`gpt-tokenizer/encoding/${encoding}`);
  const encode = (mod.encode ?? mod.default?.encode) as EncodeFn | undefined;
  if (typeof encode !== 'function') {
    throw new Error(`gpt-tokenizer encoding "${encoding}" did not export an encode function`);
  }
  const wrapped: EncodeFn = (text: string) => encode(text);
  encoderCache.set(encoding, wrapped);
  return wrapped;
}

function fallbackEstimate(text: string): number {
  return Math.ceil(text.length / 4);
}

export class TokenEstimator {
  private readonly options: TokenEstimatorOptions;
  private encoderPromise: Promise<EncodeFn> | null = null;
  private encoder: EncodeFn | null = null;

  constructor(options: TokenEstimatorOptions = {}) {
    this.options = options;
    void this.ensureEncoder();
  }

  private get encoding(): TokenizerEncoding {
    return this.options.encoding ?? 'o200k_base';
  }

  get driftMultiplier(): number {
    return this.options.driftMultiplier ?? 1.15;
  }

  private ensureEncoder(): Promise<EncodeFn> {
    if (this.encoder) return Promise.resolve(this.encoder);
    if (!this.encoderPromise) {
      this.encoderPromise = loadEncoder(this.encoding).then((fn) => {
        this.encoder = fn;
        return fn;
      }).catch(() => {
        return fallbackEstimate as unknown as EncodeFn;
      });
    }
    return this.encoderPromise;
  }

  countText(text: string): number {
    if (!text) return 0;
    const raw = this.encoder ? this.encoder(text).length : fallbackEstimate(text);
    return Math.ceil(raw * this.driftMultiplier);
  }

  countMessage(message: AIMessage): number {
    let tokens = 0;
    const content = message.content;
    if (typeof content === 'string') {
      tokens += this.countText(content);
    } else if (Array.isArray(content)) {
      for (const part of content as Array<{ type?: string; text?: string; image_url?: unknown }>) {
        if (part.type === 'text') tokens += this.countText(part.text ?? '');
        else if (part.type === 'image_url') tokens += IMAGE_TOKEN_ESTIMATE;
      }
    }

    const toolCalls = message.tool_calls;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const args = (tc as { function?: { arguments?: string } })?.function?.arguments ?? '';
        tokens += PER_TOOL_CALL_OVERHEAD + this.countText(typeof args === 'string' ? args : JSON.stringify(args));
      }
    }

    if (message.tool_call_id) tokens += 3;
    if (message.name) tokens += this.countText(message.name);
    if (message.reasoning) tokens += this.countText(message.reasoning);

    return tokens + PER_MESSAGE_OVERHEAD;
  }

  countMessages(messages: AIMessage[]): number {
    return messages.reduce((sum, m) => sum + this.countMessage(m), 0);
  }

  countToolDefinitions(tools: unknown[]): number {
    if (!tools.length) return 0;
    const schemaText = JSON.stringify(tools);
    const baseTokens = this.countText(schemaText);
    const overhead = tools.length * PER_TOOL_CALL_OVERHEAD;
    return baseTokens + overhead;
  }

  /** Force encoder preload (useful before synchronous counting paths). */
  async preload(): Promise<void> {
    await this.ensureEncoder();
  }
}
