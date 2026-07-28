/** 将 `YYYY-MM-DDTHH:mm` 视为 Asia/Shanghai 墙上时间，返回 UTC 毫秒时间戳 */
export function parseShanghaiLocalDateTimeInput(value: string): number {
  if (!value?.trim()) return NaN;
  const v = value.trim().length === 13 ? `${value}:00` : value.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi] = m;
  return Date.parse(`${y}-${mo}-${d}T${h}:${mi}:00+08:00`);
}

/** 起止 datetime-local（上海）之间包含的日历日列表（YYYY-MM-DD，含首尾） */
export function enumerateShanghaiCalendarDays(rangeFrom: string, rangeTo: string): string[] {
  const startDay = rangeFrom?.trim().slice(0, 10) || '';
  const endDay = rangeTo?.trim().slice(0, 10) || '';
  if (!startDay || !endDay) return startDay ? [startDay] : [];

  const startMs = parseShanghaiLocalDateTimeInput(`${startDay}T00:00`);
  const endMs = parseShanghaiLocalDateTimeInput(`${endDay}T00:00`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [endDay];

  const [fromMs, toMs] = startMs <= endMs ? [startMs, endMs] : [endMs, startMs];
  const days: string[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  for (let t = fromMs; t <= toMs; t += dayMs) {
    days.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(t))
    );
  }
  return days.length > 0 ? days : [endDay];
}
