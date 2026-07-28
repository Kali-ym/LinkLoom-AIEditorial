import type { Message } from '../domain/types';
import type { StreamingMessage } from '../stores/types';

/** Stable fallbacks — never use inline `?? []` inside zustand selectors. */
export const EMPTY_MESSAGES: Message[] = [];
export const EMPTY_REACTIONS: string[] = [];

export function selectMessagesForTopic(topicId: string | null | undefined) {
  return (s: { messagesByTopicId: Record<string, Message[]> }) => {
    if (!topicId) return EMPTY_MESSAGES;
    return s.messagesByTopicId[topicId] ?? EMPTY_MESSAGES;
  };
}

export function selectMessageById(topicId: string, messageId: string) {
  return (s: { messagesByTopicId: Record<string, Message[]> }) =>
    s.messagesByTopicId[topicId]?.find((m) => m.id === messageId);
}

const MINIMAP_THRESHOLD = 3;

export function selectStreamingMessageForTopic(topicId: string | null | undefined) {
  return (s: { streamingByTopicId: Record<string, StreamingMessage> }) => {
    if (!topicId) return null;
    return s.streamingByTopicId[topicId] ?? null;
  };
}

export function selectMinimapVisible(topicId: string | null | undefined) {
  return (s: { messagesByTopicId: Record<string, Message[]> }) => {
    const msgs = topicId ? (s.messagesByTopicId[topicId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES;
    return msgs.filter((m) => m.role === 'user').length > MINIMAP_THRESHOLD;
  };
}
