/**
 * 格式化展示用工具：从原 Dashboard 抽取，供调度中心 KPI 复用。
 */

export function formatLastCommit(dateStr: string | null | undefined): string {
  if (!dateStr) return '暂无提交';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '暂无提交';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} 天前`;

    return dateStr.split('T')[0];
  } catch {
    return '暂无提交';
  }
}

export function formatUptime(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '未知';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0 || parts.length === 0) parts.push(`${m}分钟`);
  return parts.join(' ');
}

/**
 * 计算今日聚合条目相对昨日的同比百分比，返回带正负号的字符串。
 * 当昨日为 0 时返回空字符串（无意义）。
 */
export function computeDailyTrend(today?: number, yesterday?: number): string {
  if (!yesterday || yesterday <= 0) return '';
  const t = today ?? 0;
  const pct = Math.round(((t - yesterday) / yesterday) * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export function formatDateTime(time?: string | null): string {
  if (!time) return '—';
  try {
    return new Date(time).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}
