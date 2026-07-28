export enum ContextTokenCategory {
  SystemPrompt = 'system_prompt',
  ToolDefinitions = 'tool_definitions',
  Rules = 'rules',
  Skills = 'skills',
  Mcp = 'mcp',
  SubagentDefinitions = 'subagent_definitions',
  Conversation = 'conversation',
  SummarizedConversation = 'summarized_conversation'
}

export interface ContextBreakdown {
  byCategory: Record<string, number>;
  totalTokens: number;
  adjustedTotal: number;
  driftMultiplier: number;
  countedAt?: string;
}

export type TopicContextUsage = {
  completionTokens: number;
  promptTokens: number;
  totalTokens: number;
  updatedAt?: string;
  byCategory?: Record<string, number>;
  adjustedTotal?: number;
  driftMultiplier?: number;
  maxContextTokens?: number;
  reserveOutputTokens?: number;
  compactionBuffer?: number;
  remainingTokens?: number;
  usageRatio?: number;
  source?: 'counter' | 'provider' | 'estimate';
  round?: number;
  compacted?: boolean;
};

export interface ContextUsageSnapshot {
  byCategory: Record<string, number>;
  totalTokens: number;
  adjustedTotal: number;
  driftMultiplier: number;
  countedAt?: string;
  maxContextTokens: number;
  reserveOutputTokens: number;
  compactionBuffer: number;
  remainingTokens: number;
  usageRatio: number;
  source: 'counter' | 'provider' | 'estimate';
  round?: number;
  compacted?: boolean;
}
