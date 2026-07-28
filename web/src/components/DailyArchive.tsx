'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { todayInShanghai } from '@/lib/format';
import { formatMonthTitle } from '@/lib/dailyArchiveCalendar';
import { formatGregorianLine } from '@/lib/chineseCalendar';
import type { DailyIssueSummary, ReportDateEntry } from '@/lib/types';
import { DailyArchiveCalendarMonth } from './DailyArchiveCalendarMonth';

interface Props {
  dates: ReportDateEntry[];
  current: string;
  issue?: DailyIssueSummary;
}

export function DailyArchive({ dates, current, issue }: Props) {
  const today = todayInShanghai();
  const currentMonth = current.slice(0, 7);
  const gregorian = formatGregorianLine(current);

  const lookup = new Map<string, ReportDateEntry>();
  for (const d of dates) lookup.set(d.date, d);

  const byMonth = new Map<string, ReportDateEntry[]>();
  for (const d of dates) {
    const key = d.date.slice(0, 7);
    const arr = byMonth.get(key) || [];
    arr.push(d);
    byMonth.set(key, arr);
  }
  const monthEntries = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const [folded, setFolded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [month] of monthEntries) {
      init[month] = month !== currentMonth;
    }
    return init;
  });

  const toggleMonth = (month: string) => {
    setFolded((prev) => ({ ...prev, [month]: !prev[month] }));
  };

  return (
    <aside className="hidden h-full min-h-0 w-[288px] shrink-0 flex-col border-r border-hairline bg-surface-soft/60 xl:flex">
      <div className="shrink-0 p-4">
        <div className="relative overflow-hidden rounded-lg border border-hairline bg-gradient-to-br from-surface-soft via-canvas to-surface-warm p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/12 blur-2xl" />
          <div className="pointer-events-none absolute -left-6 bottom-[-1.5rem] h-20 w-20 rounded-full bg-accent-teal/10 blur-2xl" />

          <div className="relative">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Archive
                </p>
                <h2 className="mt-1 text-lg font-semibold leading-tight tracking-[-0.02em] text-ink">
                  日报归档
                </h2>
              </div>
              <span className="shrink-0 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs font-semibold tabular-nums text-muted">
                {dates.length}
              </span>
            </div>

            <div className="mt-4 rounded-md border border-hairline bg-canvas/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                当前期次
              </p>

              <p className="mt-1.5 text-xs font-medium leading-snug text-body">{gregorian}</p>

              {issue?.stats ? (
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <span className="rounded-sm bg-surface-soft px-2 py-1 text-center text-[11px] font-medium tabular-nums text-body">
                    {issue.stats.events} 条报道
                  </span>
                  <span className="rounded-sm bg-surface-soft px-2 py-1 text-center text-[11px] font-medium tabular-nums text-body">
                    {issue.stats.sources} 信源
                  </span>
                  <span className="rounded-sm bg-surface-soft px-2 py-1 text-center text-[11px] font-medium tabular-nums text-body">
                    {issue.stats.firsthand} 一手
                  </span>
                  <span className="rounded-sm bg-surface-soft px-2 py-1 text-center text-[11px] font-medium tabular-nums text-body">
                    {issue.stats.newModels} 模型
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {monthEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-hairline bg-canvas px-4 py-8 text-center text-sm text-muted">
            暂无已发布日报
          </p>
        ) : (
          <div className="space-y-3">
            {monthEntries.map(([month, monthDates]) => {
              const isFolded = folded[month] ?? true;
              const isCurrentMonth = month === currentMonth;

              return (
                <section
                  key={month}
                  className={`overflow-hidden rounded-lg border bg-canvas shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
                    isCurrentMonth ? 'border-primary/25' : 'border-hairline'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMonth(month)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-soft/80"
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold tracking-[-0.01em] ${
                          isCurrentMonth ? 'text-ink' : 'text-body'
                        }`}
                      >
                        {formatMonthTitle(month)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{monthDates.length} 期已发布</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isCurrentMonth && (
                        <span className="rounded-sm bg-surface-warm px-2 py-0.5 text-[11px] font-semibold text-primary">
                          本月
                        </span>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 text-muted transition-transform duration-200 ${
                          isFolded ? '' : 'rotate-180'
                        }`}
                      />
                    </div>
                  </button>

                  {!isFolded && (
                    <div className="border-t border-hairline-soft px-3.5 pb-4 pt-3">
                      <DailyArchiveCalendarMonth
                        monthKey={month}
                        lookup={lookup}
                        current={current}
                        today={today}
                      />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
