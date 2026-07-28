'use client';

import Link from 'next/link';
import type { ReportDateEntry } from '@/lib/types';
import { WEEKDAY_LABELS, monthDays, monthStartDow } from '@/lib/dailyArchiveCalendar';

interface Props {
  monthKey: string;
  lookup: Map<string, ReportDateEntry>;
  current: string;
  today: string;
  compact?: boolean;
  /** 点击日期后回调（如关闭抽屉） */
  onDateSelect?: () => void;
}

export function DailyArchiveCalendarMonth({
  monthKey,
  lookup,
  current,
  today,
  compact = false,
  onDateSelect
}: Props) {
  const days = monthDays(monthKey);
  const startDow = monthStartDow(monthKey);

  const cell = compact ? 'h-9 w-9 text-sm' : 'h-10 w-10 text-sm';

  return (
    <div>
      <div className={`mb-2.5 grid grid-cols-7 ${compact ? 'gap-0.5' : 'gap-1'}`}>
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="text-center text-xs font-semibold uppercase tracking-wide text-muted"
          >
            {label}
          </span>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${compact ? 'gap-0.5' : 'gap-1'}`}>
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`pad-${i}`} className={compact ? 'h-9' : 'h-10'} aria-hidden />
        ))}

        {days.map((date) => {
          const entry = lookup.get(date);
          const hasReport = !!entry;
          const isToday = date === today;
          const isActive = date === current;
          const href = date === today ? '/daily' : `/daily/${date}`;
          const dayNum = Number(date.slice(8, 10));
          const label = hasReport ? `${date} 日报` : date;

          return (
            <div key={date} className="relative flex items-center justify-center">
              {hasReport ? (
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={onDateSelect}
                  className={`relative flex ${cell} items-center justify-center rounded-md font-medium tabular-nums transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-subtle'
                      : 'border border-hairline bg-surface-card text-ink hover:border-primary/30 hover:bg-surface-cream'
                  }`}
                >
                  {dayNum}
                  {isToday && !isActive && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-accent-teal px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-white">
                      New
                    </span>
                  )}
                </Link>
              ) : (
                <span
                  aria-hidden
                  className={`flex ${cell} items-center justify-center rounded-md tabular-nums text-muted/30 ${
                    isToday ? 'ring-1 ring-dashed ring-hairline text-muted/50' : ''
                  }`}
                >
                  {dayNum}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
