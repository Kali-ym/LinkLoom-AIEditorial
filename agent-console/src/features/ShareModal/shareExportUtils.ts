import type { Message, Topic } from '../../domain/types';

const LOADING_FLAT = '...';

export interface ShareTextFieldType {
  includeTool: boolean;
  includeUser: boolean;
  withRole: boolean;
  withSystemRole: boolean;
}

export interface ShareJsonFieldType {
  exportMode: 'full' | 'simple';
  includeTool: boolean;
  withSystemRole: boolean;
}

export function exportTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function generateShareMarkdown({
  messages,
  title,
  includeTool,
  includeUser,
  withSystemRole,
  withRole,
  systemRole,
}: ShareTextFieldType & {
  messages: Message[];
  systemRole: string;
  title: string;
}): string {
  const parts: string[] = [`# ${title}`, ''];

  if (withSystemRole && systemRole.trim()) {
    parts.push('````md', systemRole.trim(), '````', '');
  }

  const filteredMessages = messages
    .filter((m) => m.content !== LOADING_FLAT)
    .filter((m) => (includeUser ? true : m.role !== 'user'))
    .filter((m) => (includeTool ? true : m.role !== 'tool'));

  for (const chat of filteredMessages) {
    parts.push('');

    if (withRole) {
      if (chat.role === 'user') {
        parts.push('##### User:', '');
      } else if (chat.role === 'assistant') {
        parts.push('##### Assistant:', '');
      } else if (chat.role === 'tool') {
        parts.push('##### Tools Calling:', '');
      }
    }

    if (chat.role === 'tool') {
      parts.push('```json', String(chat.content), '```');
    } else {
      parts.push(String(chat.content));

      if (includeTool && chat.tools && chat.tools.length > 0) {
        parts.push('', '```json', JSON.stringify(chat.tools, null, 2), '```');
      }
    }
  }

  return parts.join('\n');
}

export function generateShareMessagesJson({
  messages,
  withSystemRole,
  includeTool,
  systemRole,
}: Pick<ShareJsonFieldType, 'includeTool' | 'withSystemRole'> & {
  messages: Message[];
  systemRole: string;
}) {
  const defaultMessages = messages
    .filter((m) => m.content !== LOADING_FLAT)
    .filter((m) => (includeTool ? true : m.role !== 'tool'))
    .map((m) => ({
      content: m.content.trim(),
      role: m.role,
      tools: includeTool && m.tools ? m.tools : undefined,
    }));

  return withSystemRole && systemRole.trim()
    ? [{ content: systemRole.trim(), role: 'system' as const }, ...defaultMessages]
    : defaultMessages;
}

export function generateShareFullExport({
  topic,
  messages,
  systemRole,
  withSystemRole,
  includeTool,
}: ShareJsonFieldType & {
  messages: Message[];
  systemRole: string;
  topic?: Topic;
}) {
  const exportedMessages = messages
    .filter((m) => m.content !== LOADING_FLAT)
    .filter((m) => (includeTool ? true : m.role !== 'tool'))
    .map((m) => ({
      content: m.content,
      createdAt: m.createdAt,
      id: m.id,
      role: m.role,
      threadId: m.threadId,
      tools: includeTool ? m.tools : undefined,
    }));

  return {
    exportedAt: new Date().toISOString(),
    messages: exportedMessages,
    systemRole: withSystemRole && systemRole.trim() ? systemRole.trim() : undefined,
    topic: topic
      ? {
          id: topic.id,
          title: topic.title,
          status: topic.status,
        }
      : undefined,
  };
}
