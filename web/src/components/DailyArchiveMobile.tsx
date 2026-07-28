'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { todayInShanghai } from '@/lib/format';
import { formatMonthTitle } from '@/lib/dailyArchiveCalendar';
import type { ReportDateEntry } from '@/lib/types';
import { DailyArchiveCalendarMonth } from './DailyArchiveCalendarMonth';

interface Props {
  dates: ReportDateEntry[];
  current: string;
}

export function DailyArchiveMobile({ dates, current }: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => current.slice(0, 7));

  const today = todayInShanghai();
  const currentMonth = current.slice(0, 7);

  const sorted = useMemo(
    () => [...dates].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [dates]
  );

  const lookup = useMemo(() => {
    const map = new Map<string, ReportDateEntry>();
    for (const d of dates) map.set(d.date, d);
    return map;
  }, [dates]);

  /** 有日报的月份，新 → 旧 */
  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const d of sorted) keys.add(d.date.slice(0, 7));
    return [...keys].sort((a, b) => (a < b ? 1 : -1));
  }, [sorted]);

  const viewIndex = monthKeys.indexOf(viewMonth);

  useEffect(() => {
    if (!open) return;
    const preferred = monthKeys.includes(currentMonth) ? currentMonth : monthKeys[0];
    if (preferred) setViewMonth(preferred);
  }, [open, currentMonth, monthKeys]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (sorted.length === 0) {
    return null;
  }

  const goOlder =
    viewIndex >= 0 && viewIndex < monthKeys.length - 1
      ? () => setViewMonth(monthKeys[viewIndex + 1])
      : undefined;
  const goNewer =
    viewIndex > 0 ? () => setViewMonth(monthKeys[viewIndex - 1]) : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="打开日报归档"
        aria-expanded={open}
        className="absolute right-4 top-3 z-40 flex h-10 items-center gap-1.5 rounded-md border border-hairline bg-canvas/95 px-3 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-colors hover:bg-surface-soft xl:hidden sm:right-6 sm:top-4"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
        <span>归档</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="presentation">
          <button
            type="button"
            aria-label="关闭归档"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-archive-sheet-title"
            className="absolute inset-x-0 bottom-0 flex max-h-[min(80vh,560px)] flex-col rounded-t-xl border border-b-0 border-hairline bg-canvas shadow-[0_-8px_40px_rgba(15,23,42,0.12)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div className="min-w-0">
                <p id="daily-archive-sheet-title" className="text-base font-semibold text-ink">
                  日报归档
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted">
                  当前 {current} · 共 {sorted.length} 期
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline text-muted transition-colors hover:bg-surface-soft hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <section className="rounded-lg border border-hairline bg-surface-soft/50 p-3.5">
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goOlder}
                    disabled={!goOlder}
                    aria-label="上一个月"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-canvas text-muted transition-colors hover:bg-surface-soft hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <label className="min-w-0 flex-1">
                    <span className="sr-only">选择年月</span>
                    <select
                      value={viewMonth}
                      onChange={(e) => setViewMonth(e.target.value)}
                      aria-label="选择年月"
                      className="h-9 w-full rounded-md border border-hairline bg-canvas px-3 text-center text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {monthKeys.map((month) => (
                        <option key={month} value={month}>
                          {formatMonthTitle(month)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={goNewer}
                    disabled={!goNewer}
                    aria-label="下一个月"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-canvas text-muted transition-colors hover:bg-surface-soft hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <DailyArchiveCalendarMonth
                  monthKey={viewMonth}
                  lookup={lookup}
                  current={current}
                  today={today}
                  compact
                  onDateSelect={() => setOpen(false)}
                />
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
