import type { AIMessage } from '../../../types/index.js';
import { expandAgentMessageToRuntimeMessages } from '../runtime/persistedToolHistory.js';
import type { AgentMessage } from './AgentRunSpec.js';

export interface RuntimeHistoryRehydrationResult {
  messages: AIMessage[];
  cacheSafe: boolean;
  legacyToolMessageCount: number;
}

/**
 * Rehydrate persisted messages through one path for normal, HITL and queued
 * recovery. User uploads still need the asynchronous AgentService resolver;
 * this helper handles the deterministic message representation.
 */
export function rehydratePersistedAgentMessage(
  message: AgentMessage
): RuntimeHistoryRehydrationResult {
  const messages = expandAgentMessageToRuntimeMessages(message);
  const legacyToolMessageCount = countLegacyToolMessages(message);
  return {
    messages,
    cacheSafe: legacyToolMessageCount === 0,
    legacyToolMessageCount
  };
}

export function rehydratePersistedMessages(
  messages: AgentMessage[]
): RuntimeHistoryRehydrationResult {
  const results = messages.map(rehydratePersistedAgentMessage);
  return {
    messages: results.flatMap((result) => result.messages),
    cacheSafe: results.every((result) => result.cacheSafe),
    legacyToolMessageCount: results.reduce(
      (total, result) => total + result.legacyToolMessageCount,
      0
    )
  };
}

function countLegacyToolMessages(message: AgentMessage): number {
  if (message.role !== 'assistant') return 0;
  const toolCalls = message.metadata?.toolCalls;
  if (!Array.isArray(toolCalls)) return 0;
  return toolCalls.filter((toolCall) => {
    if (!toolCall || typeof toolCall !== 'object') return true;
    return typeof (toolCall as Record<string, unknown>).canonicalMessageContent !== 'string';
  }).length;
}
