import { describe, expect, it } from 'vitest';

import { formatMessageTime } from './userMessageContent';

describe('formatMessageTime', () => {
  const now = new Date('2026-06-23T10:00:00.000Z').getTime();

  it('returns 刚刚 for timestamps within one minute', () => {
    expect(formatMessageTime('2026-06-23T09:59:30.000Z', now)).toBe('刚刚');
  });

  it('returns minutes ago', () => {
    expect(formatMessageTime('2026-06-23T09:55:00.000Z', now)).toBe('5 分钟前');
  });

  it('returns hours ago', () => {
    expect(formatMessageTime('2026-06-23T07:00:00.000Z', now)).toBe('3 小时前');
  });

  it('returns days ago within three days', () => {
    expect(formatMessageTime('2026-06-22T10:00:00.000Z', now)).toBe('1 天前');
    expect(formatMessageTime('2026-06-20T10:00:00.000Z', now)).toBe('3 天前');
  });

  it('returns month and day beyond three days in the same year', () => {
    expect(formatMessageTime('2026-06-19T10:00:00.000Z', now)).toBe('6月19日');
  });

  it('returns year month day across years', () => {
    expect(formatMessageTime('2025-12-01T10:00:00.000Z', now)).toBe('2025年12月1日');
  });

  it('parses legacy HH:mm as today', () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    expect(formatMessageTime('09:55', now.getTime())).toBe('5 分钟前');
  });
});
