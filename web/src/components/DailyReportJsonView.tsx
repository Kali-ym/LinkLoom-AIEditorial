import type { DailyReportJson, DailyReportJsonItem, ReportDateEntry } from '@/lib/types';
import { DailyBodyMarkdown } from './DailyBodyMarkdown';
import { DailyFooter } from './DailyFooter';

interface Props {
  report: DailyReportJson;
  dates: ReportDateEntry[];
}

function renderSourceLine(item: DailyReportJsonItem) {
  const display = item.sourceMeta?.displayText?.trim();
  if (display) return display;
  const sourceList = Array.isArray(item.sourceItems) ? item.sourceItems : [];
  const fallback = sourceList[0] as { source?: unknown; author?: unknown } | undefined;
  const src = typeof fallback?.source === 'string' ? fallback.source : '';
  const author = typeof fallback?.author === 'string' ? fallback.author : '';
  return [src, author].filter(Boolean).join(' · ');
}

export function DailyReportJsonView({ report, dates }: Props) {
  const headlines = Array.isArray(report.headlines) ? report.headlines : [];
  const sections = (Array.isArray(report.sections) ? report.sections : []).filter(
    (s) => (s.items?.length ?? 0) > 0
  );
  const totalItems =
    report.stats?.totalStories ??
    sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-5 py-7 sm:px-8 sm:py-9">
        {report.description && (
          <blockquote className="mb-9 max-w-3xl border-l-4 border-primary/30 px-5 py-4 text-base leading-relaxed text-slate italic sm:text-lg">
            {report.description}
          </blockquote>
        )}

        {headlines.length > 0 && (
          <section className="mb-10 overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-sm">
            <div className="flex items-end justify-between gap-4 border-b border-hairline bg-surface-cream px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Headlines</p>
                <h2 className="mt-1 font-display text-3xl font-normal leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
                  今日要闻
                </h2>
              </div>
              <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-medium text-primary tabular-nums">
                {headlines.length} 条
              </span>
            </div>
            <ol className="divide-y divide-hairline-soft">
              {headlines.map((h) => (
                <li
                  key={`${h.rank}-${h.topicId}`}
                  className="flex items-start gap-3 px-5 py-3.5 text-[15px] leading-relaxed transition-colors hover:bg-surface-cream sm:px-6"
                >
                  <span className="w-7 shrink-0 text-right font-mono tabular-nums text-primary/80">
                    {String(h.rank).padStart(2, '0')}.
                  </span>
                  {h.url ? (
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-ink transition-colors hover:text-primary-active"
                    >
                      {h.title}
                    </a>
                  ) : (
                    <span className="font-medium text-ink">{h.title}</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {sections.length === 0 ? (
          <p className="py-16 text-center text-muted">该日暂无正文条目。</p>
        ) : (
          sections.map((section, sIdx) => {
            const num = String(sIdx + 1).padStart(2, '0');
            const subtitle = section.subtitle?.trim();
            return (
              <section key={section.id || sIdx} className="mb-9 sm:mb-11">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div className="flex min-w-0 items-end gap-3">
                    <span className="font-display text-4xl leading-none tracking-[-0.04em] text-primary tabular-nums sm:text-5xl">
                      {num}
                    </span>
                    <div className="min-w-0 pb-1">
                      <h2 className="font-display text-3xl font-normal leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
                        {section.title || section.id}
                      </h2>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-soft">
                        {subtitle || `Section ${num}`}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 pb-1 text-sm font-medium text-primary tabular-nums">
                    {section.items.length} 篇
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-sm">
                  {section.items.map((item, idx) => {
                    const sourceLine = renderSourceLine(item);
                    return (
                      <article
                        key={`${section.id}-${item.topicId || idx}`}
                        className={`px-4 py-5 sm:px-6 sm:py-6 ${
                          idx === section.items.length - 1 ? '' : 'border-b border-hairline'
                        }`}
                      >
                        <h3 className="font-display text-2xl font-normal leading-[1.16] tracking-[-0.03em] sm:text-3xl">
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-ink transition-colors hover:text-primary-active"
                            >
                              {item.title}
                            </a>
                          ) : (
                            <span className="text-ink">{item.title}</span>
                          )}
                        </h3>
                        {sourceLine && (
                          <p className="mt-2 break-words text-xs leading-relaxed text-muted">
                            {sourceLine}
                          </p>
                        )}
                        {(item.headlineCandidate || typeof item.aiScore === 'number') && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-soft">
                            {item.headlineCandidate && (
                              <span className="rounded-full border border-primary/20 bg-canvas px-2 py-0.5 font-medium text-primary">
                                要闻
                              </span>
                            )}
                            {typeof item.aiScore === 'number' && (
                              <span className="font-mono tabular-nums">AI {item.aiScore}</span>
                            )}
                          </div>
                        )}
                        <DailyBodyMarkdown body={item.bodyMd} className="mt-4" />
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      <DailyFooter
        current={report.date || ''}
        available={dates}
        basePath="/daily"
        stats={{
          events: totalItems,
          firsthand: report.stats?.primaryReports ?? 0,
          newModels: report.stats?.newModels ?? 0,
          sources: report.stats?.sources ?? 0
        }}
      />
    </div>
  );
}