import type { AgentMessage, AgentMessageContentPart } from './engine/AgentRunSpec.js';

export interface ParsedConsoleMessageId {
  runId: string;
  kind: 'user' | 'assistant';
  userIndex?: number;
}

export function parseConsoleMessageId(messageId: string): ParsedConsoleMessageId | null {
  if (messageId.endsWith(':thread:assistant')) {
    return {
      runId: messageId.slice(0, -':thread:assistant'.length),
      kind: 'assistant',
    };
  }
  if (messageId.endsWith(':assistant:output')) {
    return {
      runId: messageId.slice(0, -':assistant:output'.length),
      kind: 'assistant',
    };
  }

  const threadUser = messageId.match(/^(.+):thread:user:(\d+)$/);
  if (threadUser) {
    return {
      runId: threadUser[1],
      kind: 'user',
      userIndex: Number(threadUser[2]),
    };
  }

  const inputUser = messageId.match(/^(.+):input:(\d+)$/);
  if (inputUser) {
    return {
      runId: inputUser[1],
      kind: 'user',
      userIndex: Number(inputUser[2]),
    };
  }

  return null;
}

export function stringifyAgentMessageContent(content: AgentMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((part: AgentMessageContentPart) => (part.kind === 'text' ? part.text ?? '' : part.text ?? ''))
    .filter(Boolean)
    .join('\n');
}

export function buildConsoleMessageId(
  runId: string,
  role: AgentMessage['role'],
  index: number,
): string {
  if (role === 'assistant') return `${runId}:thread:assistant`;
  return `${runId}:thread:user:${index}`;
}
