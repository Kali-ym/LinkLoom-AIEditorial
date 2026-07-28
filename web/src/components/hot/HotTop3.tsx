'use client';

import type { HotEvent } from '@/lib/types';

const ease = 'duration-200 ease-[cubic-bezier(0.2,0,0,1)]';

interface Props {
  events: HotEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function truncateTitle(title: string, max: number): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

const topSpine = [
  'before:bg-rank-1',
  'before:bg-rank-2',
  'before:bg-rank-3'
] as const;

const topActiveBg = [
  'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--ll-rank-1)_12%,transparent),transparent_80%)]',
  'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--ll-rank-2)_12%,transparent),transparent_80%)]',
  'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--ll-rank-3)_14%,transparent),transparent_80%)]'
] as const;

const topNum = ['text-rank-1', 'text-rank-2', 'text-rank-3'] as const;
const topHeat = ['text-rank-1', 'text-rank-2', 'text-rank-3'] as const;
const topSrcBorder = [
  'border-[color-mix(in_srgb,var(--ll-rank-1)_22%,var(--ll-hairline))]',
  'border-[color-mix(in_srgb,var(--ll-rank-2)_22%,var(--ll-hairline))]',
  'border-[color-mix(in_srgb,var(--ll-rank-3)_22%,var(--ll-hairline))]'
] as const;

/** Side-by-side TOP3 (medal) + ranks 4–10 — matches hot-top3-prototype.html. */
export function HotTop3({ events, selectedId, onSelect }: Props) {
  const top3 = events.slice(0, 3);
  const rest = events.slice(3, 10);

  if (top3.length === 0) return null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] sm:gap-x-7">
      <ol className="list-none" aria-label="热搜前三">
        {top3.map((ev, i) => {
          const rank = i + 1;
          const active = selectedId === ev.id;
          const heat = Math.round(ev.heat);
          const sources = Math.max(
            ev.sourceCount || 0,
            new Set(ev.members.map((m) => m.sourceLabel)).size
          );
          return (
            <li key={ev.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(ev.id)}
                className={`relative grid w-full grid-cols-[3rem_minmax(0,1fr)] gap-2.5 py-3.5 pe-2 ps-2.5 text-left transition-colors ${ease} before:absolute before:bottom-2 before:start-0 before:top-2 before:w-[3px] before:origin-center before:rounded-sm before:content-[''] before:transition-transform before:duration-200 before:ease-[cubic-bezier(0.2,0,0,1)] ${topSpine[i]} ${
                  active ? `before:scale-y-100 ${topActiveBg[i]}` : 'before:scale-y-0 hover:bg-surface-soft/75'
                } ${rank < top3.length ? 'border-b border-hairline/90' : ''}`}
              >
                <span
                  className={`pt-0.5 font-display leading-none tracking-[-0.04em] tabular-nums ${
                    rank === 1 ? 'text-[2.05rem] tracking-[-0.05em]' : 'text-[1.55rem]'
                  } ${topNum[i]}`}
                >
                  {String(rank).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block font-display leading-[1.3] tracking-[-0.02em] text-pretty ${
                      rank === 1
                        ? 'text-[1.12rem] tracking-[-0.025em] text-ink'
                        : 'text-base text-ink/80'
                    } ${active ? 'text-ink' : ''}`}
                  >
                    {truncateTitle(ev.title, rank === 1 ? 40 : 32)}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`font-mono font-semibold tabular-nums tracking-tight ${
                        rank === 1 ? 'text-[1.08rem]' : 'text-[0.95rem]'
                      } ${topHeat[i]}`}
                    >
                      {heat}
                    </span>
                    <span
                      aria-hidden
                      className="size-0.5 shrink-0 rounded-full bg-muted/55"
                    />
                    <span
                      className={`inline-flex items-baseline gap-1 rounded-full border bg-surface-soft/85 px-2 py-[0.12rem] font-mono text-[11px] font-semibold tabular-nums tracking-tight text-ink ${topSrcBorder[i]}`}
                    >
                      <span className={topHeat[i]}>{sources}</span>
                      <span className="font-sans text-[10px] font-medium tracking-[0.06em] text-muted">
                        信源
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {rest.length > 0 && (
        <div className="min-w-0 border-t border-hairline pt-3.5 sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0">
          <ol className="list-none" aria-label="第 4 至 10 名">
            {rest.map((ev, i) => {
              const rank = i + 4;
              const active = selectedId === ev.id;
              const quiet = rank >= 7;
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(ev.id)}
                    className={`grid w-full grid-cols-[1.55rem_minmax(0,1fr)_auto] items-baseline gap-1.5 rounded px-1.5 py-[0.42rem] text-left transition-colors ${ease} ${
                      active ? 'bg-primary/10' : 'hover:bg-ink/[0.03]'
                    }`}
                  >
                    <span
                      className={`font-mono text-[11px] font-semibold tabular-nums ${
                        active ? 'text-primary' : 'text-muted'
                      }`}
                    >
                      {String(rank).padStart(2, '0')}
                    </span>
                    <span
                      className={`truncate tracking-[-0.01em] ${
                        active
                          ? 'font-medium text-ink'
                          : quiet
                            ? rank >= 9
                              ? 'text-[11.5px] text-ink/45'
                              : 'text-xs text-ink/55'
                            : 'text-[12.5px] text-ink/70'
                      }`}
                    >
                      {ev.title}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-semibold tabular-nums ${
                        active ? 'text-rank-rest-active' : 'text-rank-rest'
                      }`}
                    >
                      {Math.round(ev.heat)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
