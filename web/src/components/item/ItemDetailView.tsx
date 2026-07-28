import { SourceFavicon } from '@/components/SourceFavicon';
import { TagPill } from '@/components/TagPill';
import { HideBrokenImages } from '@/components/item/HideBrokenImages';
import {
  CATEGORY_META,
  SOURCE_TYPE_META,
  formatDayHeading,
  formatHHMM,
  formatRelativeTime,
  sourceHostLabel
} from '@/lib/format';
import { renderArticleBodyHtml } from '@/lib/renderArticleBody';
import type { ItemDetail } from '@/lib/types';

export async function ItemDetailView({ item }: { item: ItemDetail }) {
  const categoryLabel = item.categoryId ? CATEGORY_META[item.categoryId]?.label : undefined;
  const sourceTypeLabel = item.sourceType ? SOURCE_TYPE_META[item.sourceType]?.label : undefined;
  const bodyHtml =
    item.bodyStatus === 'full' && item.bodyHtml
      ? await renderArticleBodyHtml(item.bodyHtml, { stripTitle: item.title })
      : '';
  const showFullBody = bodyHtml.length > 40;
  const host = sourceHostLabel(item.sourceUrl);
  const relative = formatRelativeTime(item.publishedAt);
  const absolute = `${formatDayHeading(item.publishedAt)} · ${formatHHMM(item.publishedAt)}`;

  const metaBits = [sourceTypeLabel, categoryLabel, relative || absolute].filter(Boolean) as string[];

  return (
    <article className="relative">
      <div className="flex items-center justify-end gap-4 border-b border-hairline px-5 py-3.5 sm:px-10">
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-primary"
          >
            原文
            <span
              aria-hidden
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink/[0.06] text-[11px] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-px"
            >
              ↗
            </span>
          </a>
        ) : (
          <span className="text-sm text-muted-soft">原文不可用</span>
        )}
      </div>

      {/* Wider reading column: use most of ContentPanel (1280) instead of ~42rem */}
      <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-8 sm:px-10 sm:pb-16 sm:pt-10 lg:px-12">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <SourceFavicon
              url={item.sourceUrl}
              imageUrl={item.sourceImage}
              label={item.sourceLabel}
              size={40}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                {item.sourceLabel}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-relaxed text-muted">
                {metaBits.map((bit, i) => (
                  <span key={`${bit}-${i}`} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span className="text-muted-soft" aria-hidden>·</span>}
                    <span>{bit}</span>
                  </span>
                ))}
                {item.picked && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-soft" aria-hidden>·</span>
                    <span className="font-medium text-primary">精选</span>
                  </span>
                )}
              </p>
              <time dateTime={item.publishedAt} className="sr-only">
                {absolute}
              </time>
            </div>
          </div>

          {typeof item.score === 'number' && (
            <div className="shrink-0 text-right" title="AI 评分" aria-label={`AI 评分 ${item.score}`}>
              <p className="font-mono text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight text-ink sm:text-[2rem]">
                {item.score}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-soft">
                Score
              </p>
            </div>
          )}
        </header>

        <h1 className="mt-7 max-w-4xl text-balance font-display text-[1.65rem] font-normal leading-[1.18] tracking-[-0.03em] text-ink sm:mt-8 sm:text-[2.15rem] sm:leading-[1.12] sm:tracking-[-0.035em]">
          {item.title}
        </h1>

        <nav
          className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"
          aria-label="文内导航"
        >
          {item.recommendation && (
            <a
              href="#picked-reason"
              className="text-muted transition-colors duration-200 hover:text-primary"
            >
              精选理由
            </a>
          )}
          {item.recommendation && item.summary && (
            <span className="text-muted-soft" aria-hidden>
              ·
            </span>
          )}
          {item.summary && (
            <a
              href="#ai-summary"
              className="text-muted transition-colors duration-200 hover:text-primary"
            >
              AI 摘要
            </a>
          )}
          {showFullBody && (item.summary || item.recommendation) && (
            <span className="text-muted-soft" aria-hidden>
              ·
            </span>
          )}
          {showFullBody && (
            <a
              href="#article-body"
              className="text-muted transition-colors duration-200 hover:text-primary"
            >
              跳到正文
            </a>
          )}
        </nav>

        {item.recommendation && (
          <aside
            id="picked-reason"
            className="mt-8 max-w-4xl scroll-mt-6 overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.06] px-5 py-5 sm:mt-9 sm:px-6 sm:py-6"
          >
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              精选理由
            </p>
            <p className="mt-3 font-display text-[1.15rem] leading-[1.45] tracking-[-0.02em] text-ink sm:text-[1.3rem] sm:leading-[1.4]">
              {item.recommendation}
            </p>
          </aside>
        )}

        {item.summary && (
          <section id="ai-summary" className="mt-8 max-w-4xl scroll-mt-6 sm:mt-9">
            <div className="rounded-xl border border-hairline bg-surface-soft/80 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                <h2 className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                  AI 摘要
                </h2>
                <p className="text-[11px] leading-relaxed text-muted-soft">
                  模型生成，可能有偏差；请以原文为准
                </p>
              </div>
              <p className="mt-3.5 text-pretty text-[15px] leading-[1.75] text-body sm:text-[0.98rem] sm:leading-[1.72]">
                {item.summary}
              </p>
            </div>
          </section>
        )}

        {showFullBody ? (
          <section
            id="article-body"
            className="mt-11 scroll-mt-6 border-t border-hairline pt-10 sm:mt-14 sm:pt-12"
          >
            <div className="mb-6 flex items-center gap-3">
              <h2 className="font-display text-2xl tracking-[-0.03em] text-ink sm:text-[1.65rem]">
                正文
              </h2>
              <span className="h-px min-w-[2.5rem] flex-1 bg-hairline" aria-hidden />
            </div>
            <div
              className="item-prose mt-1 max-w-4xl"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
            <HideBrokenImages />
          </section>
        ) : (
          <section className="mt-11 max-w-4xl border-t border-hairline pt-10 sm:mt-14 sm:pt-12">
            <p className="text-[15px] leading-relaxed text-muted">
              站内仅有摘要。完整内容请到原站阅读，版权归原作者与原站所有。
            </p>
          </section>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <TagPill key={t}>{t}</TagPill>
            ))}
          </div>
        )}

        {item.sourceUrl && (
          <div className="mt-10 sm:mt-12">
            {!item.summary && (
              <p className="mb-3 text-[12px] leading-relaxed text-muted-soft">
                摘要由模型生成，可能有偏差；请以原文为准。
              </p>
            )}
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex h-11 items-center gap-3 rounded-md bg-primary px-5 text-sm font-medium text-on-primary transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-primary-active active:scale-[0.98]"
            >
              <span>在原站阅读{host ? ` · ${host}` : ''}</span>
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-px"
              >
                ↗
              </span>
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
