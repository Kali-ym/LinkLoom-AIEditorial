import type { TopicImportPayload } from '../../topicImportAdapter';
import { generateTopicId } from '../../../services/topic/topicId';

export interface RunContextMessage {
  role: 'assistant' | 'user';
  content: string;
}

export function mapImportMessagesToRunContext(messages: unknown[] | undefined): RunContextMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const role = record.role;
    if (role !== 'user' && role !== 'assistant') return [];

    const content =
      typeof record.content === 'string'
        ? record.content
        : typeof record.text === 'string'
          ? record.text
          : record.content != null
            ? JSON.stringify(record.content)
            : '';

    const trimmed = content.trim();
    if (!trimmed) return [];

    return [{ role, content: trimmed }];
  });
}

export function resolveImportTitle(payload: TopicImportPayload, fileName: string): string {
  return payload.title?.trim() || fileName.replace(/\.json$/i, '') || '导入的话题';
}

export function resolveImportSessionId(): string {
  return generateTopicId();
}

export function resolveImportRunInput(messages: RunContextMessage[], fallbackTitle: string): string {
  const firstUser = messages.find((message) => message.role === 'user');
  return firstUser?.content ?? fallbackTitle;
}
