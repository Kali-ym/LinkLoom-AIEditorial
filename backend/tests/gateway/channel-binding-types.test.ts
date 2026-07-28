import { describe, expect, it } from 'vitest';
import {
  CHANNEL_BINDING_WILDCARD,
  isChannelBinding,
  normalizeWildcard,
  queryKey,
  RESOLVE_MATCH_LEVELS,
  RESOLVE_STRATEGIES,
} from '../../src/services/gateway/channelBindingTypes.js';

describe('channelBindingTypes', () => {
  it('normalizes wildcard markers to null', () => {
    expect(normalizeWildcard('*')).toBeNull();
    expect(normalizeWildcard('')).toBeNull();
    expect(normalizeWildcard(null)).toBeNull();
    expect(normalizeWildcard(undefined)).toBeNull();
  });

  it('passes through concrete values', () => {
    expect(normalizeWildcard('alice_bot')).toBe('alice_bot');
    expect(normalizeWildcard('123456')).toBe('123456');
  });

  it('isChannelBinding accepts a complete binding', () => {
    const now = Date.now();
    expect(
      isChannelBinding({
        id: 'bnd_1',
        channel: 'telegram',
        accountId: null,
        peerId: null,
        agentId: 'a1',
        priority: 0,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      })
    ).toBe(true);
  });

  it('isChannelBinding rejects incomplete bindings', () => {
    expect(
      isChannelBinding({ id: 'x', channel: 'telegram' })
    ).toBe(false);
    expect(isChannelBinding(null)).toBe(false);
    expect(isChannelBinding('not-an-object')).toBe(false);
  });

  it('queryKey is stable and channel-aware', () => {
    expect(queryKey({ channel: 'cli' })).toBe('cli|*|*');
    expect(queryKey({ channel: 'cli', accountId: null, peerId: null })).toBe('cli|*|*');
    expect(queryKey({ channel: 'tg', accountId: 'a', peerId: 'p' })).toBe('tg|a|p');
  });

  it('wildcard constant is "*"', () => {
    expect(CHANNEL_BINDING_WILDCARD).toBe('*');
  });

  it('strategy + level enums have expected shape', () => {
    expect(RESOLVE_STRATEGIES).toContain('specific');
    expect(RESOLVE_STRATEGIES).toContain('fallback');
    expect([...RESOLVE_MATCH_LEVELS]).toEqual([1, 2, 3, 4]);
  });
});
