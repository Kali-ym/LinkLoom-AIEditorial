import { writeStoredActiveTopicId } from '../../adapters/api/activeTopicStorage';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import type { Message } from '../../domain/types';
import { useAgentStore } from '../../stores/agentStore';
import { useChatStore } from '../../stores/chatStore';
import { useRouteStore } from '../../stores/routeStore';
import { useTopicStore } from '../../stores/topicStore';
import { saveClientTopic } from './clientTopicStorage';
import { generateTopicId } from './topicId';

export function getMainLineMessages(messages: Message[]): Message[] {
  return messages.filter((message) => !message.threadId);
}

/** 主会话中，取截止指定消息（含）的上下文。 */
export function getContextUpToMessage(messages: Message[], messageId: string): Message[] {
  const mainLine = getMainLineMessages(messages);
  const index = mainLine.findIndex((message) => message.id === messageId);
  if (index < 0) return mainLine;
  return mainLine.slice(0, index + 1);
}

/** @deprecated 使用 getContextUpToMessage */
export function getContextBeforeMessage(messages: Message[], messageId: string): Message[] {
  return getContextUpToMessage(messages, messageId);
}

function cloneMessagesForTopic(messages: Message[], topicId: string): Message[] {
  return messages.map((message, index) => ({
    ...message,
    id: `${topicId}-ctx-${index}-${message.id}`,
    threadId: undefined,
  }));
}

function resolveForkTitle(sourceTitle: string, suffix?: string): string {
  if (suffix) {
    const cleaned = suffix.replace(/^分支[：:]\s*/, '').trim();
    if (cleaned) return cleaned;
  }
  const base = sourceTitle.trim() || '话题';
  return `${base.slice(0, 28)} · 新话题`;
}

export function forkTopicFromContext(options: {
  sourceTopicId: string;
  inheritedMessages: Message[];
  title?: string;
  branchLabel?: string;
}): string | null {
  const { sourceTopicId, inheritedMessages } = options;
  if (!sourceTopicId) return null;
  if (inheritedMessages.length === 0) return null;

  const sourceTopic = useTopicStore.getState().topics.find((topic) => topic.id === sourceTopicId);
  const agentId = sourceTopic?.agentId ?? useAgentStore.getState().activeAgentId;
  const newTopicId = generateTopicId();
  const title = options.title ?? resolveForkTitle(sourceTopic?.title ?? '', options.branchLabel);
  const messages = cloneMessagesForTopic(inheritedMessages, newTopicId);

  useChatStore.getState().setMessages(newTopicId, messages);

  saveClientTopic({
    id: newTopicId,
    title,
    sourceTopicId,
    agentId: agentId || undefined,
    messages,
    seedMessages: messages,
    createdAt: new Date().toISOString(),
  });

  useTopicStore.setState((state) => ({
    activeTopicId: newTopicId,
    topics: [
      {
        id: newTopicId,
        title,
        status: 'completed',
        agentId: agentId || undefined,
        active: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      ...state.topics.map((topic) => ({ ...topic, active: false })),
    ],
  }));

  if (isAgentConsoleApiMode()) {
    writeStoredActiveTopicId(newTopicId, agentId || undefined);
  }

  useRouteStore.getState().showConversation(title);
  return newTopicId;
}

export function forkTopicFromMessage(sourceTopicId: string, messageId: string): string | null {
  const messages = useChatStore.getState().getMessages(sourceTopicId);
  const inherited = getContextUpToMessage(messages, messageId);
  return forkTopicFromContext({ sourceTopicId, inheritedMessages: inherited });
}
