import type { AgentMessageContentPart } from './messageParts';

export type { AgentMessageContentPart };

/** Backend agent message — mirrors `AgentRunSpec.AgentMessage`. */
export interface BackendAgentMessageDto {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
  content: string | AgentMessageContentPart[] | null;
  name?: string;
  toolCallId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BackendSessionMessagesDto {
  sessionId: string;
  threadId?: string;
  runIds?: string[];
  messages: BackendAgentMessageDto[];
}

export interface BackendThreadMessagesDto {
  threadId: string;
  sessionIds?: string[];
  runIds?: string[];
  messages: BackendAgentMessageDto[];
}
