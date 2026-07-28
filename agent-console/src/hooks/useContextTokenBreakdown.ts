import { useMemo } from 'react';

import type { Message } from '../domain/types';
import type { AgentPlusState } from '../domain/types/agentChatConfig';
import { estimateTokenCount } from './useContextWindowTokens';

const TOOL_SCHEMA_OVERHEAD_PER_PLUGIN = 280;

export type ContextTokenBreakdown = {
  chatsToken: number;
  historySummaryToken: number;
  systemRoleToken: number;
  toolsToken: number;
  totalToken: number;
};

function buildSystemRoleText(plusState: AgentPlusState): string {
  const parts = [plusState.systemRole?.trim(), plusState.chatConfig.inputTemplate?.trim()].filter(
    Boolean,
  ) as string[];
  return parts.join('\n\n');
}

function buildToolsText(plusState: AgentPlusState): string {
  const enabledPluginIds = Object.keys(plusState.plugins).filter((id) => plusState.plugins[id]);
  const enabledKnowledge = plusState.knowledgeBases
    .filter((item) => item.enabled)
    .map((item) => item.name);
  const enabledFiles = plusState.files.filter((item) => item.enabled).map((item) => item.name);

  return [
    enabledPluginIds.join(' '),
    enabledKnowledge.length ? `knowledge:${enabledKnowledge.join(',')}` : '',
    enabledFiles.length ? `files:${enabledFiles.join(',')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function sliceMessagesForContext(messages: Message[], plusState: AgentPlusState): Message[] {
  if (!plusState.chatConfig.enableHistoryCount) return messages;
  const limit = plusState.chatConfig.historyCount ?? 20;
  if (limit <= 0) return [];
  return messages.slice(-limit);
}

function collectReasoningText(messages: Message[]): string {
  return messages
    .flatMap((message) => [message.reasoningBeforeTool, message.reasoningAfterTool])
    .flatMap((block) => block?.paragraphs ?? [])
    .filter(Boolean)
    .join('\n');
}

export function computeContextTokenBreakdown(
  messages: Message[],
  draft: string,
  plusState: AgentPlusState,
  topicSummary?: string,
): ContextTokenBreakdown {
  const systemRole = buildSystemRoleText(plusState);
  const toolsString = buildToolsText(plusState);
  const enabledPluginCount = Object.values(plusState.plugins).filter(Boolean).length;

  const systemRoleToken = estimateTokenCount(systemRole);
  const toolsToken =
    estimateTokenCount(toolsString) + enabledPluginCount * TOOL_SCHEMA_OVERHEAD_PER_PLUGIN;
  const historySummaryToken = estimateTokenCount(topicSummary?.trim() ?? '');

  const contextMessages = sliceMessagesForContext(messages, plusState);
  const messageText = contextMessages.map((message) => message.content ?? '').join('\n');
  const reasoningText = collectReasoningText(contextMessages);
  const chatsToken =
    estimateTokenCount(messageText) + estimateTokenCount(reasoningText) + estimateTokenCount(draft);
  const totalToken = systemRoleToken + historySummaryToken + toolsToken + chatsToken;

  return {
    chatsToken,
    historySummaryToken,
    systemRoleToken,
    toolsToken,
    totalToken,
  };
}

/** Console-style context buckets: system role, tools/skills, history summary, chats + draft. */
export function useContextTokenBreakdown(
  messages: Message[],
  draft: string,
  plusState: AgentPlusState,
  topicSummary?: string,
) {
  return useMemo(
    () => computeContextTokenBreakdown(messages, draft, plusState, topicSummary),
    [draft, messages, plusState, topicSummary],
  );
}

export function resolveMaxContextWindowTokens(
  plusState: AgentPlusState,
  modelContextWindow?: number,
): number {
  const configured = plusState.chatConfig.maxContextWindow;
  if (plusState.chatConfig.enableMaxContextWindow && typeof configured === 'number' && configured > 0) {
    return configured;
  }
  if (typeof modelContextWindow === 'number' && modelContextWindow > 0) {
    return modelContextWindow;
  }
  return 200_000;
}
