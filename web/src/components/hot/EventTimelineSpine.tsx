'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SourceFavicon } from '@/components/SourceFavicon';
import { formatDayHeading, formatHHMM } from '@/lib/format';
import { sortMembersNewestFirst } from '@/lib/sortMembersNewestFirst';
import { heatValueClass } from '@/lib/hotRank';
import { TIMELINE_GRID } from '@/lib/timelineLayout';
import type { HotEvent, HotEventMember } from '@/lib/types';

interface Props {
  event: HotEvent;
  /** 1-based board rank — colors heat metric (medal / rest). */
  rank?: number;
}

function parseOk(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function formatTimeSpan(members: HotEventMember[]): string | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const m of members) {
    const t = parseOk(m.publishedAt);
    if (t == null) continue;
    if (min == null || t < min) min = t;
    if (max == null || t > max) max = t;
  }
  if (min == null || max == null) return null;
  const startIso = new Date(min).toISOString();
  const endIso = new Date(max).toISOString();
  const sameDay =
    new Date(min).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }) ===
    new Date(max).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  if (sameDay) {
    return `${formatHHMM(startIso)}–${formatHHMM(endIso)}`;
  }
  return `${formatDayHeading(startIso)} ${formatHHMM(startIso)} – ${formatDayHeading(endIso)} ${formatHHMM(endIso)}`;
}

function OfficialBadge({ role }: { role: HotEventMember['role'] }) {
  if (role === 'primary') {
    return (
      <span className="inline-flex items-center rounded-full border border-primary bg-primary px-2.5 py-0.5 text-[11px] font-medium text-on-primary">
        官方
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-hairline bg-surface-soft px-2.5 py-0.5 text-[11px] font-medium text-body">
      非官方
    </span>
  );
}

/** Rail column: continuous segment + node (line lives here so it never drifts). */
function TimelineRail({
  role,
  isFirst,
  isLast
}: {
  role: HotEventMember['role'];
  isFirst: boolean;
  isLast: boolean;
}) {
  const official = role === 'primary';
  return (
    <div className="relative flex justify-center self-stretch">
      {/* Upper segment → center of node */}
      {!isFirst && (
        <span
          aria-hidden
          className="absolute start-1/2 top-0 h-[1.125rem] w-[2px] -translate-x-1/2 bg-primary/35"
        />
      )}
      {/* Lower segment → next row */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute start-1/2 top-[1.125rem] bottom-[-1.25rem] w-[2px] -translate-x-1/2 bg-gradient-to-b from-primary/35 via-primary/25 to-primary/20"
        />
      )}

      <span
        aria-hidden
        className={`relative z-10 mt-[0.65rem] flex size-[0.875rem] shrink-0 items-center justify-center rounded-full ${
          official
            ? 'bg-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--ll-primary)_22%,transparent)]'
            : 'bg-canvas ring-[2.5px] ring-primary/55'
        }`}
      >
        {official && <span className="size-1.5 rounded-full bg-canvas/90" />}
      </span>
    </div>
  );
}

function HotMemberCard({
  member,
  isFirst,
  isLast
}: {
  member: HotEventMember;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = member.summary || '';
  const collapseSummary = summary.length > 220;
  const summaryDisplay = expanded || !collapseSummary ? summary : `${summary.slice(0, 220)}…`;

  return (
    <div className={`${TIMELINE_GRID} items-stretch`}>
      <time
        dateTime={member.publishedAt}
        className="pt-2 text-right font-mono text-sm font-semibold leading-none text-ink timeline-anchor sm:text-base"
      >
        {formatHHMM(member.publishedAt)}
      </time>

      <TimelineRail role={member.role} isFirst={isFirst} isLast={isLast} />

      <article className="group relative min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface-card p-4 shadow-subtle sm:p-5">
        <div className="relative z-[1]">
          <header className="flex min-w-0 items-center gap-2.5">
            <SourceFavicon
              url={member.url}
              imageUrl={member.sourceImage}
              label={member.sourceLabel}
              size={36}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate text-sm font-medium text-body-strong">
                {member.sourceLabel}
              </span>
              <OfficialBadge role={member.role} />
            </div>
          </header>

          <h3 className="mt-2.5 font-display text-[1.2rem] font-normal leading-[1.25] tracking-[-0.02em] text-ink">
            <Link
              href={member.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-primary-active"
            >
              {member.title}
            </Link>
          </h3>

          {summary ? (
            <section className="mt-3">
              <div className="rounded-lg border border-hairline bg-surface-soft/80 px-3.5 py-3.5 sm:px-4 sm:py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h4 className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                    AI 摘要
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-soft">
                    模型生成，可能有偏差；请以原文为准
                  </p>
                </div>
                <p className="mt-2.5 max-w-[62ch] whitespace-pre-wrap text-pretty text-sm leading-relaxed text-body">
                  {summaryDisplay}
                </p>
                {collapseSummary && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 text-sm font-medium text-primary transition-colors hover:text-primary-active"
                  >
                    {expanded ? '收起' : '展开'}
                  </button>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-[4.5rem]">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight ${
          valueClass ?? 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function EventTimelineSpine({ event, rank = 0 }: Props) {
  const members = useMemo(() => sortMembersNewestFirst(event.members), [event.members]);
  const span = useMemo(() => formatTimeSpan(event.members), [event.members]);
  const sourceN = Math.max(event.sourceCount || 0, new Set(members.map((m) => m.sourceLabel)).size);

  if (members.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-display text-xl tracking-[-0.02em] text-ink">暂无关联报道</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:gap-8">
        <Metric
          label="热度"
          value={String(Math.round(event.heat))}
          valueClass={rank > 0 ? heatValueClass(rank) : 'text-primary'}
        />
        <Metric label="信源" value={String(sourceN)} />
        <Metric label="跨度" value={span ?? '—'} />
      </div>

      <div className="space-y-5">
        {members.map((m, i) => (
          <HotMemberCard
            key={m.itemId}
            member={m}
            isFirst={i === 0}
            isLast={i === members.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
