import { Solar } from 'lunar-javascript';

const CN_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** 公历一行：2026年5月24日 · 星期日 */
export function formatGregorianLine(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const [, yyyy, mm, dd] = m;
  const weekday = weekdayInShanghai(date);
  return `${Number(yyyy)}年${Number(mm)}月${Number(dd)}日 · ${weekday}`;
}

/** 农历一行：丙午年四月廿八 */
export function formatLunarLine(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  try {
    const lunar = Solar.fromYmd(y, mo, d).getLunar();
    return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  } catch {
    return '';
  }
}

function weekdayInShanghai(date: string): string {
  try {
    const day = new Date(`${date}T12:00:00+08:00`).getDay();
    return CN_WEEKDAYS[day] ?? '';
  } catch {
    return '';
  }
}

export function formatVol(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const [, yyyy, mm, dd] = m;
  return `${yyyy}.${mm}.${dd}`;
}
