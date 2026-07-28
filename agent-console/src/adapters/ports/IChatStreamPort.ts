/** Stream events consumed by chatStore stream reducer (subset of mock StreamingHandler). */
export type ChatStreamEventType =
  | 'text'
  | 'reasoning_part'
  | 'reasoning'
  | 'grounding'
  | 'tool_calls'
  | 'content_part'
  | 'usage_update'
  | 'base64_image'
  | 'stop'
  | 'context_usage_preview'
  | 'context_compacted';

export interface ChatStreamEvent {
  type: ChatStreamEventType | string;
  content?: string;
  text?: string;
  block?: 1 | 2;
  data?: unknown;
  tools?: unknown[];
  alt?: string;
  usage?: {
    completionTokens: number;
    promptTokens: number;
    totalTokens: number;
    breakdown?: import('../../domain/types/contextUsage').ContextBreakdown;
  };
  contextSnapshot?: import('../../domain/types/contextUsage').ContextUsageSnapshot;
}

export interface ChatStreamHandlers {
  /** Plain text delta — mapped to `content_part` when `onEvent` is absent. */
  onChunk?: (chunk: string) => void;
  onEvent?: (event: ChatStreamEvent) => void;
  /** Fired after all mapped events from one SSE parse batch are delivered. */
  onAfterBatch?: () => void;
  /** Fired when a batch contained `run_paused` — finish the stream after the full batch. */
  onRunPausedBatch?: () => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export interface ChatStreamSubscribeOptions {
  /** Skip events at or below this sequence (SSE resume after permission pause). */
  lastSeq?: number;
}

export interface IChatStreamPort {
  subscribe(
    runId: string,
    handlers: ChatStreamHandlers,
    options?: ChatStreamSubscribeOptions,
  ): () => void;
}
