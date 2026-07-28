import type { Message } from '../../../domain/types';

export type RunContextMessage = {
  role: 'assistant' | 'user';
  content: string;
};

function extractAssistantText(message: Message): string {
  return message.content?.trim() ?? '';
}

function extractUserText(message: Message): string {
  return (message.content || message.text || '').trim();
}

/** Map visible chat history into backend run `messages` (excludes the in-flight user turn). */
export function mapTopicMessagesToRunContext(messages: Message[]): RunContextMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as 'assistant' | 'user',
      content: message.role === 'assistant' ? extractAssistantText(message) : extractUserText(message),
    }))
    .filter((message) => message.content.length > 0);
}
