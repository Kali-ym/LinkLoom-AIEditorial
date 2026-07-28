'use client';

import { formatDayHeading, formatHHMM } from '@/lib/format';
import { groupFeedItemsByShanghaiDate } from '@/lib/groupFeedByDate';
import { itemPermalink } from '@/lib/permalink';
import { scoreTone } from '@/lib/timelineLayout';
import type { TimelineFeedItem } from '@/lib/types';

interface Props {
  items: TimelineFeedItem[];
  showHotBadge?: boolean;
}

const MAX_VISIBLE_TAGS = 3;

/** Shared column template — keeps header and body aligned under table-fixed. */
const COLGROUP = (
  <colgroup>
    {/* Fits「时间」on one line with pl-5/sm:pl-8; not so wide it leaves a dead gap after HH:MM. */}
    <col style={{ width: '6rem' }} />
    <col />
    <col style={{ width: '10.5rem' }} />
    <col style={{ width: '12rem' }} />
    <col style={{ width: '5.25rem' }} />
  </colgroup>
);

function dayHeadingLabel(dateKey: string): string {
  return formatDayHeading(`${dateKey}T12:00:00+08:00`);
}

function TagChips({ tags }: { tags?: string[] }) {
  if (!tags?.length) return <span className="text-muted">—</span>;
  const visible = tags.slice(0, MAX_VISIBLE_TAGS);
  const overflow = tags.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((t, i) => (
        <span
          key={t}
          className={`inline-flex max-w-[7rem] truncate rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[11px] text-body ${
            i === 0 ? 'font-semibold' : 'font-medium'
          }`}
        >
          #{t}
        </span>
      ))}
      {overflow > 0 && <span className="text-[11px] text-muted">+{overflow}</span>}
    </div>
  );
}

function ScoreCell({ score, picked }: { score?: number; picked?: boolean }) {
  if (typeof score !== 'number') {
    return <span className="text-muted">—</span>;
  }
  const tone = scoreTone(score);
  const label = picked ? `精选 · AI 评分 ${score}` : `AI 评分 ${score}`;
  const showGlow = picked || tone.band === 'elite' || tone.band === 'high';
  return (
    <div className="relative flex h-full items-center justify-end pr-0.5" title={label} aria-label={label}>
      {showGlow ? (
        <span
          aria-hidden
          className={`pointer-events-none absolute top-1/2 right-0 h-10 w-10 -translate-y-1/2 rounded-full blur-[8px] ${tone.glowClass} ${
            picked ? 'opacity-100' : 'opacity-55'
          }`}
        />
      ) : null}
      <span
        className={`relative font-display italic font-medium leading-none tabular-nums tracking-[-0.055em] ${tone.display} ${tone.size} ${tone.shadow} ${
          picked ? 'translate-x-px -rotate-[5deg] scale-105' : ''
        }`}
      >
        {score}
      </span>
    </div>
  );
}

function TitleCell({ item, showHotBadge }: { item: TimelineFeedItem; showHotBadge?: boolean }) {
  const href = item.permalink || itemPermalink(item.id);
  const summary = item.summaryShort || item.summary;
  return (
    <div className="min-w-0">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-ink transition-colors hover:text-primary"
      >
        {item.title}
      </a>
      {showHotBadge && (
        <p className="mt-0.5 text-[11px] font-medium text-primary">来自热搜</p>
      )}
      {summary && <p className="mt-0.5 truncate text-sm text-muted">{summary}</p>}
    </div>
  );
}

export function FeedTable({ items, showHotBadge = false }: Props) {
  const groups = groupFeedItemsByShanghaiDate(items);

  return (
    <>
      {/* Desktop: one table so columns stay locked; day rows are sticky separators */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[48rem] table-fixed text-left text-sm">
          {COLGROUP}
          <thead>
            <tr className="border-b border-hairline text-xs font-medium text-muted">
              <th className="whitespace-nowrap py-3 pl-5 pr-2 font-medium sm:pl-8">时间</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium sm:px-4">标题 / 摘要</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium sm:px-4">来源</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium sm:px-4">标签</th>
              <th className="py-3 pl-2 pr-5 text-right font-medium sm:pr-8">评分</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <FragmentDayGroup
                key={group.dateKey}
                dateKey={group.dateKey}
                items={group.items}
                showHotBadge={showHotBadge}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: compact time + content, still day-sectioned */}
      <div className="md:hidden">
        {groups.map((group) => (
          <section key={group.dateKey}>
            <h2 className="sticky top-0 z-20 border-b border-hairline bg-surface/95 px-5 py-3 font-display text-xl font-normal tracking-[-0.03em] text-ink backdrop-blur sm:px-8">
              {dayHeadingLabel(group.dateKey)}
            </h2>
            <ul className="divide-y divide-hairline">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-5 py-3.5 hover:bg-surface-soft/80 sm:px-8"
                >
                  <time
                    dateTime={item.publishedAt}
                    className="pt-0.5 font-mono text-xs tabular-nums text-ink"
                  >
                    {formatHHMM(item.publishedAt)}
                  </time>
                  <div className="min-w-0">
                    <TitleCell item={item} showHotBadge={showHotBadge} />
                    <p className="mt-1 truncate text-xs text-muted">
                      {item.sourceLabel || item.source}
                    </p>
                    <div className="mt-1.5">
                      <TagChips tags={item.tags} />
                    </div>
                  </div>
                  <ScoreCell score={item.score} picked={item.picked} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function FragmentDayGroup({
  dateKey,
  items,
  showHotBadge
}: {
  dateKey: string;
  items: TimelineFeedItem[];
  showHotBadge?: boolean;
}) {
  return (
    <>
      <tr className="border-b border-hairline">
        <td
          colSpan={5}
          className="sticky top-0 z-20 bg-surface/95 px-5 py-3 backdrop-blur sm:px-8"
        >
          <h2 className="font-display text-xl font-normal tracking-[-0.03em] text-ink sm:text-2xl">
            {dayHeadingLabel(dateKey)}
          </h2>
        </td>
      </tr>
      {items.map((item) => (
        <tr
          key={item.id}
          className="border-b border-hairline transition-colors hover:bg-surface-soft/80"
        >
          <td className="whitespace-nowrap py-3.5 pl-5 pr-2 align-top font-mono text-xs tabular-nums text-ink sm:pl-8 sm:text-sm">
            <time dateTime={item.publishedAt}>{formatHHMM(item.publishedAt)}</time>
          </td>
          <td className="px-3 py-3.5 align-top sm:px-4">
            <TitleCell item={item} showHotBadge={showHotBadge} />
          </td>
          <td className="px-3 py-3.5 align-top text-muted sm:px-4">
            <span className="line-clamp-2">{item.sourceLabel || item.source}</span>
          </td>
          <td className="px-3 py-3.5 align-top sm:px-4">
            <TagChips tags={item.tags} />
          </td>
          <td className="py-3.5 pl-2 pr-5 align-middle sm:pr-8">
            <ScoreCell score={item.score} picked={item.picked} />
          </td>
        </tr>
      ))}
    </>
  );
}

export function FeedTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="px-4 py-2 sm:px-6" aria-hidden>
      <div className="mb-3 hidden h-3 w-full max-w-xl rounded bg-surface-soft md:block" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-10 shrink-0 rounded bg-surface-soft" />
            <div className="h-3 min-w-0 flex-1 rounded bg-surface-soft" />
            <div className="hidden h-3 w-24 shrink-0 rounded bg-surface-soft md:block" />
            <div className="hidden h-3 w-20 shrink-0 rounded bg-surface-soft lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
