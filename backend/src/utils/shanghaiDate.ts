/** Asia/Shanghai 墙上时间工具（与 admin dateUtils 语义一致） */

export function parseShanghaiLocalDateTimeInput(value: string): number {
  if (!value?.trim()) return NaN;
  const trimmed = value.trim();
  const v =
    trimmed.length === 13 ? `${trimmed}:00` : trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return Date.parse(v);
  const [, y, mo, d, h, mi, sec = '00'] = m;
  return Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${sec}+08:00`);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Shanghai wall Y/M/D and weekday (0=Sun … 6=Sat). */
export function shanghaiCalendarParts(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: weekdayMap[get('weekday')] ?? 0
  };
}

/** Monday 00:00 Asia/Shanghai of the calendar week containing `now`. */
export function startOfShanghaiCalendarWeek(now: Date = new Date()): Date {
  const { year, month, day, weekday } = shanghaiCalendarParts(now);
  const daysFromMonday = (weekday + 6) % 7;
  const dayStart = Date.parse(
    `${year}-${pad2(month)}-${pad2(day)}T00:00:00+08:00`
  );
  return new Date(dayStart - daysFromMonday * 86_400_000);
}

/** 1st 00:00 Asia/Shanghai of the calendar month containing `now`. */
export function startOfShanghaiCalendarMonth(now: Date = new Date()): Date {
  const { year, month } = shanghaiCalendarParts(now);
  return new Date(Date.parse(`${year}-${pad2(month)}-01T00:00:00+08:00`));
}
