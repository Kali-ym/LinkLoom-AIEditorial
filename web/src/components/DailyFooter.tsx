import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftDate, todayInShanghai } from '@/lib/format';
import type { DailyDigestStats, ReportDateEntry } from '@/lib/types';

const STAT_ITEMS: Array<{ key: keyof DailyDigestStats; label: string }> = [
  { key: 'events', label: '今日事件' },
  { key: 'firsthand', label: '一手报道' },
  { key: 'newModels', label: '新模型' },
  { key: 'sources', label: '信源' }
];

interface Props {
  current: string;
  available: ReportDateEntry[];
  stats: DailyDigestStats;
  /** 上下页 / 历史索引使用的 base 路由,默认 `/daily` */
  basePath?: string;
}

export function DailyFooter({ current, available, stats, basePath = '/daily' }: Props) {
  const dateList = available.map((d) => d.date);
  const set = new Set(dateList);
  const tryDate = (delta: number) => {
    let candidate = shiftDate(current, delta);
    for (let i = 0; i < 30; i++) {
      if (set.has(candidate) || dateList.length === 0) return candidate;
      candidate = shiftDate(candidate, delta);
    }
    return current;
  };

  const prev = tryDate(-1);
  const next = tryDate(1);
  const hasPrev = set.has(prev) && prev !== current;
  const hasNext = set.has(next) && next !== current;
  const isToday = current === todayInShanghai();

  const navLink =
    'inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-body transition-colors hover:text-primary sm:gap-1 sm:text-sm';
  const navDisabled = `${navLink} pointer-events-none opacity-40`;
  const historyLink =
    'inline-flex whitespace-nowrap text-xs font-medium text-body transition-colors hover:text-primary sm:text-sm';

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-hairline bg-gradient-to-br from-surface-soft via-canvas to-surface-warm text-body">
      <div className="pointer-events-none absolute -right-24 bottom-[-6rem] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 top-[-4rem] h-52 w-52 rounded-full bg-accent-teal/10 blur-3xl" />

      <div className="relative px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-x-6 gap-y-8 text-center sm:grid-cols-4 sm:gap-y-6">
          {STAT_ITEMS.map(({ key, label }) => (
            <div key={key} className="min-w-0">
              <div className="font-display text-4xl font-medium tabular-nums text-ink sm:text-5xl">
                {stats[key] ?? 0}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <nav
        aria-label="日报日期导航"
        className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-hairline px-4 py-4 sm:gap-4 sm:px-8 sm:py-6"
      >
        <div className="min-w-0 justify-self-start">
          {hasPrev ? (
            <Link href={`${basePath}/${prev}`} className={navLink}>
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              前一日
            </Link>
          ) : (
            <span className={navDisabled}>
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              前一日
            </span>
          )}
        </div>

        <div className="min-w-0 justify-self-center px-1">
          <Link href={basePath} className={historyLink}>
            查看历史
          </Link>
        </div>

        <div className="min-w-0 justify-self-end">
          {hasNext && !isToday ? (
            <Link href={`${basePath}/${next}`} className={navLink}>
              后一日
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          ) : (
            <span className={navDisabled}>
              后一日
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </span>
          )}
        </div>
      </nav>

      <div className="relative flex flex-col items-center justify-between gap-4 border-t border-hairline px-5 py-6 text-[11px] text-muted sm:flex-row sm:px-8">
        <p className="text-center tracking-[0.18em] sm:text-left">LinkLoom · 编辑系统自动生成</p>
        <div className="flex shrink-0 items-center gap-5">
          <a href="/rss.xml" className="hover:text-primary transition-colors">
            RSS
          </a>
          <Link href="/about" className="hover:text-primary transition-colors">
            关于
          </Link>
        </div>
      </div>
    </footer>
  );
}
