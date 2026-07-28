import type { GroundingData } from '../../domain/types/grounding';
import type { ToolPayload } from '../../domain/types/tool';
import type { ContextBreakdown, ContextUsageSnapshot } from '../../domain/types/contextUsage';

export type StreamEventType =
  | 'text'
  | 'reasoning_part'
  | 'reasoning'
  | 'grounding'
  | 'tool_calls'
  | 'content_part'
  | 'turn_failed'
  | 'usage_update'
  | 'base64_image'
  | 'hitl_context'
  | 'workspace_fallback'
  | 'run_paused'
  | 'stop'
  | 'context_usage_preview'
  | 'context_compacted';

export interface WorkspaceFallbackData {
  fallback: string;
  fallbackReason?: string;
}

export interface HitlContextData {
  runId: string;
  permissionId?: string;
  hitlRequestId?: string;
}

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  text?: string;
  block?: 1 | 2;
  data?: GroundingData | HitlContextData | WorkspaceFallbackData;
  tools?: ToolPayload[];
  alt?: string;
  usage?: {
    completionTokens: number;
    promptTokens: number;
    totalTokens: number;
    breakdown?: ContextBreakdown;
  };
  contextSnapshot?: ContextUsageSnapshot;
}
