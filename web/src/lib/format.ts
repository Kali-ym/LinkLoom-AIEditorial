import type { FeedCategory } from './categories';
import type { FeedSourceType } from './types';

export const SOURCE_TYPE_META: Record<FeedSourceType, { label: string; cls: string }> = {
  official: { label: '官方', cls: 'bg-ink/5 text-ink border-ink/15' },
  kol: { label: 'X·KOL', cls: 'bg-primary text-on-primary border-primary' },
  media: { label: '综合资讯', cls: 'bg-surface-card text-body border-hairline' },
  academic: { label: '学术机构', cls: 'bg-primary/10 text-primary border-primary/25' },
  blog: { label: '大咖博客', cls: 'bg-surface-soft text-body-strong border-hairline' }
};

export const CATEGORY_META: Record<FeedCategory, { label: string; tone: string }> = {
  model_weights: { label: '模型与权重', tone: 'text-body' },
  agent_tools: { label: 'Agent 与工具', tone: 'text-body' },
  train_infra: { label: '训推与基建', tone: 'text-body' },
  product_biz: { label: '产品与商业', tone: 'text-body' },
  safety_gov: { label: '安全与治理', tone: 'text-body' },
  research_eval: { label: '研究与评测', tone: 'text-body' }
};

export function formatHHMM(iso?: string): string {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '--:--';
  }
}

/** Relative time in Asia/Shanghai wall clock, e.g. `25分钟前` / `昨天 14:52`. */
export function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return formatDayHeading(iso);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `昨天 ${formatHHMM(iso)}`;
  if (days < 7) return `${days}天前`;
  return `${formatDayHeading(iso)} · ${formatHHMM(iso)}`;
}

export function sourceHostLabel(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function formatDayHeading(iso?: string): string {
  if (!iso) return '未知日期';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  } catch {
    return iso;
  }
}

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

export function todayInShanghai(): string {
  const now = new Date();
  const shanghai = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const y = shanghai.getFullYear();
  const m = String(shanghai.getMonth() + 1).padStart(2, '0');
  const d = String(shanghai.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDate(iso: string, days: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}