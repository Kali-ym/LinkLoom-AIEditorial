import type { Message } from '../domain/types';
import { buildPlainText } from './userMessageContent';

const TOPIC_TITLE_MAX_LEN = 48;

function firstUserMessageText(messages: Message[]): string {
  const firstUser = messages.find((message) => message.role === 'user');
  if (!firstUser) return '';
  return buildPlainText({
    text: firstUser.text,
    linkLine: firstUser.linkLine,
    linkCard: firstUser.linkCard,
    content: firstUser.content,
  });
}

/** Derive a short topic title from the first user turn in a thread. */
export function suggestTopicTitleFromMessages(messages: Message[]): string {
  const cleaned = firstUserMessageText(messages).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= TOPIC_TITLE_MAX_LEN) return cleaned;
  return `${cleaned.slice(0, TOPIC_TITLE_MAX_LEN)}…`;
}
