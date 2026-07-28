/**
 * 日期处理工具类，统一处理上海时区时间
 */

/**
 * 获取今日上海日期 (格式: YYYY-MM-DD)
 */
export const getTodayShanghai = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  }).format(new Date());
};

/**
 * 将日期字符串格式化为上海时间 (格式: YYYY-MM-DD HH:mm:ss)
 */
export const formatToShanghai = (dateStr: string | Date): string => {
  if (!dateStr) return '';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return String(dateStr);
    
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'
    }).format(date).replace(/\//g, '-');
  } catch (e) {
    return String(dateStr);
  }
};

/**
 * 将日期转换为上海时区的 Date 对象
 */
export const convertToShanghaiTime = (dateStr: string | Date): Date => {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
  
  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  parts.forEach(p => {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value);
  });
  
  return new Date(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
};

/** 将 `YYYY-MM-DDTHH:mm` 视为 Asia/Shanghai 墙上时间，返回 UTC 毫秒时间戳 */
export function parseShanghaiLocalDateTimeInput(value: string): number {
  if (!value?.trim()) return NaN;
  const v = value.trim().length === 13 ? `${value}:00` : value.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:00+08:00`;
  return Date.parse(iso);
}

/**
 * 内容筛选默认时间窗：昨日 08:00（上海）→ 今日 08:00（上海），供 `datetime-local` 初始值。
 */
export function getDefaultSelectionTimeRangeInputs(): { from: string; to: string } {
  const now = Date.now();
  const todayYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(now));

  const todayStartMs = parseShanghaiLocalDateTimeInput(`${todayYmd}T00:00`);
  const yesterdayYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(todayStartMs - 1));

  return {
    from: `${yesterdayYmd}T08:00`,
    to: `${todayYmd}T08:00`
  };
}

/** 从 `datetime-local` 值取归档日 `YYYY-MM-DD`（用于拉取当日素材库） */
export function archiveDateFromDateTimeLocal(value: string): string {
  const m = value?.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : getTodayShanghai();
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

/** 内容筛选 localStorage 缓存键（归档日 + 时间窗） */
export function getSelectionCacheScope(archiveDate: string, rangeFrom: string, rangeTo: string): string {
  return `${archiveDate}|${rangeFrom}|${rangeTo}`;
}

/** 将 ISO 时间戳格式化为上海日历日 YYYY-MM-DD（用于时间线分组） */
export function shanghaiDateKey(iso?: string): string {
  if (!iso) return '未知';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso.slice(0, 10) || '未知';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ts));
}

/** 以某日（上海）为「结束日 08:00」，构造昨日 08:00 → 该日 08:00 的起止 */
export function getSelectionTimeRangeForArchiveDay(archiveDay: string): { from: string; to: string } {
  const dayMs = parseShanghaiLocalDateTimeInput(`${archiveDay}T00:00`);
  if (!Number.isFinite(dayMs)) return getDefaultSelectionTimeRangeInputs();
  const yesterdayYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(dayMs - 1));
  return { from: `${yesterdayYmd}T08:00`, to: `${archiveDay}T08:00` };
}
