import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export interface DailyReportHeadline {
  rank: number;
  topicId: string;
  title: string;
  url?: string;
}

export interface DailyReportSourceMeta {
  kind: string;
  name: string;
  handle: string;
  format: string;
  displayText: string;
  primary: boolean;
}

export interface DailyReportItem {
  topicId: string;
  index?: number;
  rank: number;
  title: string;
  url?: string;
  section: string;
  headlineCandidate?: boolean;
  bodyMd?: string;
  aiScore?: number;
  reason?: string;
  sourceItems?: unknown[];
  sourceMeta?: DailyReportSourceMeta;
  sourceMetas?: DailyReportSourceMeta[];
}

export interface DailyReportSection {
  id: string;
  title: string;
  subtitle?: string;
  code?: string;
  order?: number;
  items: DailyReportItem[];
}

export interface DailyReportStats {
  totalStories: number;
  primaryReports: number;
  newModels: number;
  sources: number;
}

export interface DailyReportJson {
  schemaVersion?: number;
  date?: string;
  title?: string;
  linkTitle?: string;
  description?: string;
  yamlBlock?: string;
  topQuotesMd?: string;
  footerMd?: string;
  vol?: string;
  chineseDate?: string;
  brandName?: string;
  subtitle?: string;
  headlines: DailyReportHeadline[];
  sections: DailyReportSection[];
  sectionMeta?: Array<{ id: string; subtitle: string; code: string }>;
  stats?: DailyReportStats;
  meta?: {
    itemsTotal?: number;
    headlinesCount?: number;
    sectionsCount?: number;
    coverageNamespace?: string;
    generatedAt?: string;
  };
}

interface Props {
  report: DailyReportJson;
  className?: string;
}

const markdownComponents = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ink-deep dark:text-white underline decoration-ink/30 break-all"
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="my-1.5 leading-relaxed break-words" />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="my-1.5 ml-5 list-disc" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="my-1.5 ml-5 list-decimal" />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="my-0.5 leading-relaxed break-words" />
  )
};

function BodyMarkdown({ body }: { body?: string }) {
  if (!body) return null;
  return (
    <div className="text-sm text-text-charcoal dark:text-text-secondary prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
        {body}
      </ReactMarkdown>
    </div>
  );
}

const DailyReportJsonPreview: React.FC<Props> = memo(({ report, className = '' }) => {
  if (!report) return null;

  const headlines = Array.isArray(report.headlines) ? report.headlines : [];
  const sections = (Array.isArray(report.sections) ? report.sections : []).filter(
    (s) => (s.items?.length ?? 0) > 0
  );
  const totalItems = sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);

  const vol = report.vol ? `VOL.${report.vol}` : '';
  const brand = report.brandName || 'AI HOT DAILY';
  const subtitle = report.subtitle || 'DAILY · 每早八时';
  const mastheadMeta = [vol, `${totalItems} STORIES`, brand].filter(Boolean).join(' · ');

  return (
    <article className={`space-y-8 ${className}`}>
      <header className="border-b border-hairline-soft dark:border-white/10 pb-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-steel dark:text-text-secondary">
          {mastheadMeta}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-medium text-text-ink dark:text-white tracking-tight">
          {report.chineseDate || report.title || report.date}
        </h1>
        <p className="mt-1 text-xs tracking-[0.2em] text-text-slate dark:text-text-secondary">
          {subtitle}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-slate dark:text-text-secondary">
          {report.date && <span className="font-mono">{report.date}</span>}
          {report.linkTitle && <span className="text-ink-deep dark:text-white">#{report.linkTitle}</span>}
          <span className="ml-auto">
            {sections.length} 栏 / {totalItems} 条 / 要闻 {headlines.length}
          </span>
        </div>
        {report.description && (
          <p className="mt-3 text-sm text-text-charcoal dark:text-text-secondary leading-relaxed italic border-l-2 border-brand-yellow pl-3">
            {report.description}
          </p>
        )}
      </header>

      {headlines.length > 0 && (
        <section>
          <h2 className="text-base font-medium text-text-ink dark:text-white mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-ink-deep dark:text-brand-yellow">whatshot</span>
            今日要闻
          </h2>
          <ol className="space-y-1.5 ml-0.5">
            {headlines.map((h) => (
              <li
                key={`${h.rank}-${h.topicId}`}
                className="flex items-start gap-2 text-sm text-text-charcoal dark:text-text-secondary"
              >
                <span className="font-mono tabular-nums text-ink-deep dark:text-brand-yellow shrink-0 w-6 text-right">
                  {String(h.rank).padStart(2, '0')}.
                </span>
                {h.url ? (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-ink-deep dark:hover:text-brand-yellow transition-colors break-words"
                  >
                    {h.title}
                  </a>
                ) : (
                  <span className="font-medium break-words">{h.title}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {sections.length === 0 ? (
        <p className="py-16 text-center text-text-stone italic text-sm">该日暂无正文条目。</p>
      ) : (
        sections.map((section, sIdx) => {
          const num = String(sIdx + 1).padStart(2, '0');
          return (
            <section key={section.id || sIdx} className="space-y-3">
              <div className="flex items-end justify-between gap-3 border-b border-hairline-soft dark:border-white/10 pb-2">
                <div className="flex items-end gap-3 min-w-0">
                  <span className="font-mono text-2xl text-ink-deep dark:text-brand-yellow tabular-nums leading-none">
                    {num}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-medium text-text-ink dark:text-white tracking-tight leading-tight">
                      {section.title || section.id}
                    </h2>
                    {section.subtitle && (
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-text-stone">
                        {section.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-text-slate dark:text-text-secondary tabular-nums">
                  {section.items.length} 篇
                </span>
              </div>

              <ol className="space-y-4">
                {section.items.map((item, iIdx) => {
                  const sourceLine = item.sourceMeta?.displayText?.trim();
                  return (
                    <li
                      key={`${section.id}-${item.topicId || iIdx}`}
                      className="rounded-3xl border border-hairline-soft dark:border-white/5 bg-canvas dark:bg-surface-dark px-4 py-3 card-interactive-subtle"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="font-mono tabular-nums text-ink-deep dark:text-brand-yellow shrink-0 w-7 text-right text-sm">
                          {iIdx + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-text-ink dark:text-white hover:text-ink-deep dark:hover:text-brand-yellow transition-colors break-words"
                              >
                                {item.title}
                              </a>
                            ) : (
                              <span className="font-medium text-text-ink dark:text-white break-words">
                                {item.title}
                              </span>
                            )}
                            {item.headlineCandidate && (
                              <span className="chip-yellow text-[10px] px-2 py-0.5">
                                要闻
                              </span>
                            )}
                            {typeof item.aiScore === 'number' && (
                              <span className="text-[10px] font-mono text-text-slate dark:text-text-secondary ml-auto tabular-nums">
                                AI {item.aiScore}
                              </span>
                            )}
                          </div>
                          {sourceLine && (
                            <p className="mt-0.5 text-[11px] text-text-slate dark:text-text-secondary leading-relaxed">
                              {sourceLine}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="pl-9">
                        <BodyMarkdown body={item.bodyMd} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })
      )}

      {report.stats && (
        <section className="pt-6 border-t border-hairline-soft dark:border-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {([
              { key: 'totalStories', label: '今日事件' },
              { key: 'primaryReports', label: '一手报道' },
              { key: 'newModels', label: '新模型' },
              { key: 'sources', label: '信源' }
            ] as Array<{ key: keyof DailyReportStats; label: string }>).map((s) => (
              <div key={s.key}>
                <div className="text-2xl sm:text-3xl font-mono tabular-nums font-medium text-text-ink dark:text-white">
                  {report.stats?.[s.key] ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-text-slate dark:text-text-secondary">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(report.topQuotesMd || report.footerMd) && (
        <footer className="pt-6 border-t border-hairline-soft dark:border-white/10 space-y-3 text-xs text-text-slate dark:text-text-secondary">
          {report.topQuotesMd && (
            <div className="prose prose-sm dark:prose-invert max-w-none italic">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {report.topQuotesMd}
              </ReactMarkdown>
            </div>
          )}
          {report.footerMd && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {report.footerMd}
              </ReactMarkdown>
            </div>
          )}
          {report.meta?.generatedAt && (
            <div className="text-right text-[10px] font-mono opacity-70">
              生成于 {report.meta.generatedAt}
            </div>
          )}
        </footer>
      )}
    </article>
  );
});

export default DailyReportJsonPreview;
