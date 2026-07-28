export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

export function monthDays(monthKey: string): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const result: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    result.push(`${y}-${mm}-${dd}`);
  }
  return result;
}

export function monthStartDow(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).getDay();
}

export function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${Number(m)} 月 ${y}`;
}
