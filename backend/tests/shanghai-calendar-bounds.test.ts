import { describe, expect, it } from 'vitest';
import {
  startOfShanghaiCalendarMonth,
  startOfShanghaiCalendarWeek
} from '../src/utils/shanghaiDate.js';

describe('startOfShanghaiCalendarWeek', () => {
  it('returns Monday 00:00 Asia/Shanghai for a mid-week instant', () => {
    // 2026-07-24 Fri 17:00 +08
    const now = new Date('2026-07-24T09:00:00.000Z');
    const start = startOfShanghaiCalendarWeek(now);
    expect(start.toISOString()).toBe('2026-07-19T16:00:00.000Z'); // Mon 00:00 +08
  });

  it('keeps Sunday inside the week that started the prior Monday', () => {
    // 2026-07-26 Sun 10:00 +08
    const now = new Date('2026-07-26T02:00:00.000Z');
    const start = startOfShanghaiCalendarWeek(now);
    expect(start.toISOString()).toBe('2026-07-19T16:00:00.000Z');
  });

  it('on Monday morning returns that Monday', () => {
    // 2026-07-20 Mon 01:00 +08
    const now = new Date('2026-07-19T17:00:00.000Z');
    const start = startOfShanghaiCalendarWeek(now);
    expect(start.toISOString()).toBe('2026-07-19T16:00:00.000Z');
  });
});

describe('startOfShanghaiCalendarMonth', () => {
  it('returns 1st 00:00 Asia/Shanghai', () => {
    const now = new Date('2026-07-24T09:00:00.000Z');
    const start = startOfShanghaiCalendarMonth(now);
    expect(start.toISOString()).toBe('2026-06-30T16:00:00.000Z'); // Jul 1 00:00 +08
  });
});
