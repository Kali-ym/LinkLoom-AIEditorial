import { formatGregorianLine, formatLunarLine, formatVol } from '@/lib/chineseCalendar';
import type { DailyDigestStats } from '@/lib/types';

interface Props {
  date: string;
  storyCount?: number;
  vol?: string;
  stats?: DailyDigestStats;
}

function MastheadTitle() {
  return (
    <h1 className="flex flex-wrap items-baseline justify-start gap-x-0 gap-y-2 leading-[0.92] sm:justify-center lg:justify-start">
      <span className="inline-flex items-baseline whitespace-nowrap tracking-[-0.02em]">
        <span className="font-mastheadLatin text-[clamp(3.25rem,11vw,5.75rem)] font-black text-ink">
          Link
        </span>
        <span className="font-mastheadLatin text-[clamp(3.25rem,11vw,5.75rem)] font-black text-primary">
          Loom
        </span>
      </span>
      <span className="font-mastheadCn ml-2 text-[clamp(3rem,10.5vw,5.25rem)] font-black tracking-[0.06em] text-ink sm:ml-3">
        日报
      </span>
    </h1>
  );
}

const STAT_LABELS: Array<{ key: keyof DailyDigestStats; label: string }> = [
  { key: 'events', label: '报道' },
  { key: 'firsthand', label: '一手' },
  { key: 'newModels', label: '模型' },
  { key: 'sources', label: '信源' }
];

export function DailyMasthead({ date, storyCount, vol, stats }: Props) {
  const volStr = vol || formatVol(date);
  const gregorian = formatGregorianLine(date);
  const lunar = formatLunarLine(date);

  const displayStats: DailyDigestStats | undefined =
    stats ??
    (typeof storyCount === 'number'
      ? { events: storyCount, firsthand: 0, newModels: 0, sources: 0 }
      : undefined);

  const [, yyyy, mm, dd] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const dayNum = dd ? Number(dd) : null;

  return (
    <header className="relative overflow-hidden border-b border-hairline bg-gradient-to-br from-surface-soft via-canvas to-surface-warm px-5 pb-10 pt-9 max-xl:pr-[5.5rem] sm:px-8 sm:pb-12 sm:pt-11">
      <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-accent-teal/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
        aria-hidden
      />

      <div className="relative flex w-full flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10 xl:gap-14">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <MastheadTitle />

          <div
            className="mx-auto mt-7 h-px w-full max-w-md bg-gradient-to-r from-transparent via-primary/50 to-transparent lg:mx-0 lg:max-w-none lg:bg-gradient-to-r lg:from-primary/60 lg:via-primary/25 lg:to-transparent"
            aria-hidden
          />

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6 sm:gap-y-2 lg:justify-start">
            <p className="whitespace-nowrap text-base font-medium tabular-nums tracking-[-0.01em] text-ink sm:text-lg">
              {gregorian}
            </p>
            {lunar ? (
              <>
                <span className="hidden h-4 w-px bg-hairline sm:block" aria-hidden />
                <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 sm:justify-start">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/75">
                    农历
                  </span>
                  <span className="font-mastheadCn text-sm font-semibold tracking-[0.04em] text-body sm:text-base">
                    {lunar}
                  </span>
                </p>
              </>
            ) : null}
          </div>
        </div>

        <aside className="flex shrink-0 flex-col gap-5 border-t border-hairline-soft pt-6 lg:w-[min(300px,34%)] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-1 xl:w-[min(320px,32%)]">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {volStr ? (
              <span className="rounded-md border border-hairline bg-canvas/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Vol.{volStr}
              </span>
            ) : null}
          </div>

          {displayStats ? (
            <div className="grid grid-cols-4 gap-2 lg:justify-items-end">
              {STAT_LABELS.map(({ key, label }) => (
                <div
                  key={key}
                  className="rounded-md border border-hairline bg-canvas/90 px-2 py-2 text-center lg:min-w-[3.25rem]"
                >
                  <p className="font-display text-xl font-medium tabular-nums leading-none text-ink">
                    {displayStats[key]}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted">{label}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-end justify-end gap-4">
            {dayNum != null && yyyy && mm ? (
              <div className="text-right">
                <p
                  className="font-display text-[clamp(3rem,9vw,4.5rem)] font-medium leading-none tabular-nums tracking-[-0.05em] text-primary/20"
                  aria-hidden
                >
                  {String(dayNum).padStart(2, '0')}
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums tracking-[0.12em] text-muted">
                  {yyyy} · {mm}
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </header>
  );
}
