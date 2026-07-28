import { describe, expect, it } from 'vitest';

import type { Message } from '../../domain/types';
import { mergeForkSeedWithApiMessages } from './mergeForkMessages';

function msg(id: string, role: 'user' | 'assistant'): Message {
  return {
    id,
    role,
    content: id,
    createdAt: '2026-06-23T10:00:00.000Z',
  };
}

describe('mergeForkSeedWithApiMessages', () => {
  it('returns api when seed is empty', () => {
    const api = [msg('u1', 'user'), msg('a1', 'assistant')];
    expect(mergeForkSeedWithApiMessages([], api)).toEqual(api);
  });

  it('returns seed when api is empty', () => {
    const seed = [msg('u1', 'user'), msg('a1', 'assistant')];
    expect(mergeForkSeedWithApiMessages(seed, [])).toEqual(seed);
  });

  it('prepends fork seed before persisted session turns', () => {
    const seed = [msg('u1', 'user'), msg('a1', 'assistant')];
    const api = [msg('u2', 'user'), msg('a2', 'assistant')];
    expect(mergeForkSeedWithApiMessages(seed, api).map((m) => m.id)).toEqual([
      'u1',
      'a1',
      'u2',
      'a2',
    ]);
  });
});
