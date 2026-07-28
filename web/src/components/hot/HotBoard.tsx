'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { HotBoardPeriod, HotBoards, HotEvent } from '@/lib/types';
import { detailRankClass } from '@/lib/hotRank';
import { EventTimelineSpine } from './EventTimelineSpine';
import { HotPeriodSwitch, hotPeriodEmptyCopy } from './HotPeriodSwitch';
import { HotTop3 } from './HotTop3';

interface Props {
  boards: HotBoards;
  initialPeriod?: HotBoardPeriod;
}

const ease = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

export function HotBoard({ boards, initialPeriod = 'realtime' }: Props) {
  const [period, setPeriod] = useState<HotBoardPeriod>(initialPeriod);
  const events: HotEvent[] = boards[period] ?? [];
  const firstId = events[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(firstId);
  const emptyCopy = hotPeriodEmptyCopy(period);

  useEffect(() => {
    setSelectedId(firstId);
  }, [period, firstId]);

  const selected = events.find((e) => e.id === selectedId) ?? events[0] ?? null;
  const selectedRank = selected ? events.findIndex((e) => e.id === selected.id) + 1 : 0;

  return (
    <div>
      <header className="relative overflow-hidden border-b border-hairline bg-canvas px-5 pb-6 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--ll-ink) 7%, transparent) 1px, transparent 0)',
            backgroundSize: '22px 22px'
          }}
        />
        <div className="pointer-events-none absolute -right-10 -top-24 h-72 w-72 rounded-full bg-primary/[0.12] blur-3xl" />

        <div className="relative grid items-start gap-5 md:grid-cols-[minmax(168px,200px)_minmax(0,1fr)] md:gap-x-8">
          <div className="min-w-0">
            <h1 className="sr-only">热搜</h1>
            <HotPeriodSwitch period={period} onChange={setPeriod} />
          </div>

          {events.length > 0 && (
            <HotTop3 events={events} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>
      </header>

      {events.length === 0 ? (
        <div className="px-5 py-16 text-center sm:px-8">
          <p className="font-display text-2xl tracking-[-0.03em] text-ink">{emptyCopy}</p>
          {period === 'realtime' && (
            <Link
              href="/feed"
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-transform active:scale-[0.98]"
            >
              打开信息流
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-on-primary/15 text-xs transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          )}
        </div>
      ) : (
        <section className="relative min-w-0 px-5 py-7 sm:px-8 sm:py-9">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(ellipse_at_12%_0%,color-mix(in_srgb,var(--ll-primary)_9%,transparent),transparent_55%)]"
          />
          {selected && (
            <div className="relative mx-auto max-w-5xl">
              <div className="mb-6 flex flex-col gap-4 border-b border-hairline/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  {selected.tags && selected.tags.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {selected.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-md bg-surface-soft px-2.5 py-1 text-[11px] font-medium tracking-wide text-body"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                    {selectedRank > 0 && (
                      <span
                        className={`shrink-0 font-display text-2xl tabular-nums tracking-[-0.04em] ${detailRankClass(selectedRank)}`}
                      >
                        {String(selectedRank).padStart(2, '0')}
                      </span>
                    )}
                    <h2 className="min-w-0 flex-1 font-display text-[1.65rem] leading-[1.15] tracking-[-0.03em] text-ink text-balance sm:text-[1.9rem]">
                      {selected.title}
                    </h2>
                  </div>
                </div>
                <Link
                  href={`/feed?event=${encodeURIComponent(selected.id)}`}
                  className={`group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink shadow-[var(--ll-shadow-subtle)] transition-[border-color,transform] ${ease} hover:border-primary/35 active:scale-[0.98] sm:self-auto`}
                >
                  在信息流中查看
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </div>

              <EventTimelineSpine event={selected} rank={selectedRank} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
