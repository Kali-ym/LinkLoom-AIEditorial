'use client';

import type { HotBoardPeriod } from '@/lib/types';

const PERIODS: Array<{
  id: HotBoardPeriod;
  label: string;
  hint: string;
  empty: string;
}> = [
  { id: 'realtime', label: '实时榜', hint: '近窗 · 时效衰减', empty: '暂无足够成团的热搜，去信息流看看' },
  { id: 'week', label: '周榜', hint: '本周累计 · 无衰减', empty: '本周暂无足够成团的热搜' },
  { id: 'month', label: '月榜', hint: '本月累计 · 无衰减', empty: '本月暂无足够成团的热搜' }
];

const ease = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

interface Props {
  period: HotBoardPeriod;
  onChange: (period: HotBoardPeriod) => void;
}

export function hotPeriodEmptyCopy(period: HotBoardPeriod): string {
  return PERIODS.find((p) => p.id === period)?.empty ?? PERIODS[0]!.empty;
}

/** Editorial period rail for realtime / week / month boards. */
export function HotPeriodSwitch({ period, onChange }: Props) {
  const activeIndex = Math.max(
    0,
    PERIODS.findIndex((p) => p.id === period)
  );

  return (
    <div>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        Board
      </p>

      {/* Mobile: sliding segmented rail */}
      <div
        role="tablist"
        aria-label="热搜榜周期"
        className="relative grid grid-cols-3 rounded-lg bg-ink/[0.04] p-1 dark:bg-ink/[0.08] md:hidden"
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-1 start-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-canvas shadow-[var(--ll-shadow-subtle)] transition-transform ${ease}`}
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        {PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(p.id)}
              className={`relative z-[1] py-2 text-center text-[13px] tracking-wide transition-colors ${ease} active:scale-[0.98] ${
                active ? 'font-medium text-ink' : 'text-muted'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Desktop: vertical editorial index list */}
      <div
        role="tablist"
        aria-label="热搜榜周期"
        className="relative hidden md:block"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute start-0 top-1 bottom-1 w-px bg-hairline"
        />

        <div className="flex flex-col gap-1 ps-4">
          {PERIODS.map((p, i) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(p.id)}
                className={`group relative grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-2.5 rounded-md py-2.5 pe-2 text-left transition-[color,transform,background-color] ${ease} hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99] ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute -start-4 top-2 bottom-2 w-[2px] origin-center rounded-full bg-rank-1 transition-transform ${ease} ${
                    active ? 'scale-y-100' : 'scale-y-0'
                  }`}
                />
                <span
                  className={`font-display text-[1.08rem] tabular-nums tracking-[-0.04em] transition-colors ${ease} ${
                    active ? 'text-rank-1' : 'text-muted/50 group-hover:text-muted'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block font-display text-[1.08rem] leading-none tracking-[-0.025em] transition-colors ${ease} ${
                      active ? 'text-ink' : 'group-hover:text-ink/80'
                    }`}
                  >
                    {p.label}
                  </span>
                  <span
                    className={`mt-1.5 block text-[11px] leading-snug tracking-[0.02em] transition-[opacity,color] ${ease} ${
                      active ? 'text-muted opacity-100' : 'opacity-0'
                    }`}
                  >
                    {p.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2.5 text-[11px] tracking-wide text-muted md:hidden">
        {PERIODS[activeIndex]?.hint}
      </p>
    </div>
  );
}
