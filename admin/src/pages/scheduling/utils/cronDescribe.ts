/**
 * 把 Cron 表达式转换成人类可读的中文描述（覆盖常见调度场景）。
 * 不依赖外部库；对于复杂表达式回退到原表达式。
 */

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function describeCron(expression: string): string {
  if (!expression || typeof expression !== 'string') return '';
  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return trimmed;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return '每分钟';
  }

  const minuteEveryMatch = /^\*\/(\d+)$/.exec(minute);
  if (minuteEveryMatch && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `每 ${minuteEveryMatch[1]} 分钟`;
  }

  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return '每小时整点';
  }

  if (isInt(minute) && isInt(hour) && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `每天 ${pad(hour)}:${pad(minute)}`;
  }

  if (isInt(minute) && isInt(hour) && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = dayOfWeek.split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
      .map((n) => WEEKDAY_LABELS[n])
      .join('、');
    if (days) return `每${days} ${pad(hour)}:${pad(minute)}`;
  }

  if (isInt(minute) && isInt(hour) && isInt(dayOfMonth) && month === '*' && dayOfWeek === '*') {
    return `每月 ${dayOfMonth} 日 ${pad(hour)}:${pad(minute)}`;
  }

  return trimmed;
}

function isInt(value: string): boolean {
  return /^\d+$/.test(value);
}

function pad(value: string): string {
  return value.padStart(2, '0');
}
