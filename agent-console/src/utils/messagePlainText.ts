import type { Message } from '../domain/types';
import { buildPlainText } from './userMessageContent';

export type MessagePlainTextSource = Pick<
  Message,
  'role' | 'content' | 'text' | 'linkLine' | 'linkCard'
>;

export function getMessagePlainText(message: MessagePlainTextSource): string {
  if (message.role === 'user') {
    return buildPlainText({
      text: message.text,
      linkLine: message.linkLine,
      linkCard: message.linkCard,
      content: message.content,
    });
  }
  return (message.content ?? '').trim();
}
