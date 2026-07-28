import { describe, expect, it } from 'vitest';

import type { Message } from '../../domain/types';
import { getContextUpToMessage, getMainLineMessages } from './forkTopic';
import { generateTopicId, isTopicId } from './topicId';

function msg(id: string, role: 'user' | 'assistant', threadId?: string): Message {
  return {
    id,
    role,
    content: id,
    createdAt: '2026-06-23T10:00:00.000Z',
    threadId,
  };
}

describe('topicId', () => {
  it('generates tpc_ prefixed ids', () => {
    const id = generateTopicId();
    expect(isTopicId(id)).toBe(true);
    expect(id).toMatch(/^tpc_[a-z0-9]{10}$/);
  });
});

describe('forkTopic context helpers', () => {
  it('filters thread-scoped messages from main line', () => {
    const messages = [
      msg('u1', 'user'),
      msg('a1', 'assistant'),
      msg('u2', 'user', 'branch-1'),
      msg('a2', 'assistant', 'branch-1'),
    ];
    expect(getMainLineMessages(messages).map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('collects main-line messages up to and including target message', () => {
    const messages = [
      msg('u1', 'user'),
      msg('a1', 'assistant'),
      msg('u2', 'user'),
      msg('a2', 'assistant'),
    ];
    expect(getContextUpToMessage(messages, 'u2').map((m) => m.id)).toEqual(['u1', 'a1', 'u2']);
  });
});
