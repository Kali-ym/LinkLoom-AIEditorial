import type { AIMessage } from '../../../types/index.js';

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

export interface ContextTokenBreakdown {
  byCategory: Record<ContextTokenCategory, number>;
  totalTokens: number;
  adjustedTotal: number;
  driftMultiplier: number;
  countedAt: string;
}

export interface ContextUsageSnapshot extends ContextTokenBreakdown {
  maxContextTokens: number;
  reserveOutputTokens: number;
  compactionBuffer: number;
  remainingTokens: number;
  usageRatio: number;
  source: 'counter' | 'provider';
  round?: number;
  compacted?: boolean;
}

export interface ClassifiedMessage {
  message: AIMessage;
  category: ContextTokenCategory;
  subCategory?: string;
}

export interface ClassifiedToolDefinitions {
  tools: unknown[];
  category: ContextTokenCategory;
}

export interface ClassifiedModelInput {
  systemMessages: ClassifiedMessage[];
  conversationMessages: ClassifiedMessage[];
  toolDefinitions: ClassifiedToolDefinitions[];
  metadata: {
    compacted: boolean;
    summaryPresent: boolean;
    assembledAt: string;
  };
}

export function emptyBreakdown(driftMultiplier: number): ContextTokenBreakdown {
  const byCategory = {} as Record<ContextTokenCategory, number>;
  for (const cat of Object.values(ContextTokenCategory)) byCategory[cat] = 0;
  return {
    byCategory,
    totalTokens: 0,
    adjustedTotal: 0,
    driftMultiplier,
    countedAt: new Date().toISOString()
  };
}
