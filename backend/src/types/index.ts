export interface UnifiedData {
  id: string;
  title: string;
  url: string;
  description: string;
  published_date: string;
  ingestion_date?: string;
  source: string;
  category: string;
  author?: string;
  status?: string;
  metadata?: Record<string, any>;
}

export interface AIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd?: number;
  cost?: {
    input_usd?: number;
    output_usd?: number;
    total_usd?: number;
  };
  provider?: {
    providerId?: string;
    model?: string;
  };
  governance?: unknown;
  [key: string]: unknown;
}

export interface AIResponse {
  content: string;
  reasoning?: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
  usage?: AIUsage;
  raw_parts?: any[]; // Store original provider-specific parts (e.g., Gemini's thinking process)
  /** OpenAI Responses API `response.id` — used for `previous_response_id` chaining. */
  response_id?: string;
}

export interface AIMessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'developer';
  content: string | AIMessageContentPart[] | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  /** Provider reasoning / thinking text from the assistant turn (required for messages API tool follow-ups). */
  reasoning?: string;
  raw_parts?: any[]; // Store original provider-specific parts
}

export type * from './businessPipeline.js';
export type * from './rag.js';