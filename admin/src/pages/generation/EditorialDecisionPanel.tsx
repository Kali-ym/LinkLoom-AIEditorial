import React, { useMemo, useState } from 'react';
import type { EditorialPlan, EditorialTopic } from '../../types/dailyEditorial';
import type { PriorCoveragePayload } from '../../types/dailyCoverage';

const BODY_SECTIONS = [
  '模型与权重',
  'Agent 与工具',
  '训推与基建',
  '产品与商业',
  '安全与治理',
  '研究与评测'
] as const;

type EditorialDecisionPanelProps = {
  plan: EditorialPlan | null | undefined;
  priorCoverage?: PriorCoveragePayload | null;
};

const EditorialDecisionPanel: React.FC<EditorialDecisionPanelProps> = ({ plan, priorCoverage }) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<'dropped' | 'merge' | 'headlines' | 'prior' | null>(
    null
  );

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(BODY_SECTIONS.map((s) => [s, 0]));
    for (const t of plan?.topics || []) {
      const sec = t.suggested_section || '（未分类）';
      counts[sec] = (counts[sec] || 0) + 1;
    }
    return counts;
  }, [plan?.topics]);

  const headlineTopics = useMemo(() => {
    const topics = (plan?.topics || []).filter((t) => t.action === 'keep' || t.action === 'merge');
    const candidates = topics.filter((t) => t.headline_candidate);
    if (candidates.length > 0) {
      return [...candidates].sort((a, b) => (a.importance_rank ?? 99) - (b.importance_rank ?? 99));
    }
    return [...topics]
      .sort((a, b) => (a.importance_rank ?? 99) - (b.importance_rank ?? 99))
      .slice(0, 5);
  }, [plan?.topics]);

  if (!plan?.editorial_log) return null;

  const log = plan.editorial_log;
  const mergeTopics = (plan.topics || []).filter((t) => t.action === 'merge');
  const dropped = plan.dropped || [];
  const outputCount = plan.output_topic_count ?? log.topics_kept;

  const closeModal = () => {
    setOpen(false);
    setExpanded(null);
  };

  const renderTopicLine = (t: EditorialTopic) => (
    <li key={t.topic_id} className="border-l-2 border-violet-400 pl-2">
      <span className="font-medium text-text-ink dark:text-slate-100">
        #{t.importance_rank} {t.headline || t.source_items?.[0]?.title}
      </span>
      {t.suggested_section && (
        <span className="text-text-stone dark:text-text-secondary"> · {t.suggested_section}</span>
      )}
    </li>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 md:mb-4 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl md:rounded-full border border-hairline dark:border-white/10 bg-surface-lavender dark:bg-violet-950/20 px-3 py-2 sm:px-4 text-[12px] font-medium text-ink-deep dark:text-violet-200 hover:shadow-subtle md:hover:-translate-y-0.5 transition-all duration-200"
      >
        <span className="material-symbols-outlined text-[16px]">gavel</span>
        <span>编辑决策</span>
        <span className="text-text-slate dark:text-text-stone font-normal">
          素材 {log.received} 条 · 主题 {outputCount} 个
        </span>
        {priorCoverage && priorCoverage.matches.length > 0 && (
          <span className="rounded-full bg-sky-100/90 dark:bg-sky-900/30 px-1.5 py-0.5 text-[10px] text-sky-800 dark:text-sky-200">
            跨日 {priorCoverage.matches.length}
          </span>
        )}
        {headlineTopics.length > 0 && (
          <span className="rounded-full bg-amber-100/90 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-200">
            要闻 {headlineTopics.length}
          </span>
        )}
        {mergeTopics.length > 0 && (
          <span className="rounded-full bg-surface-lavender/90 dark:bg-violet-900/30 px-1.5 py-0.5 text-[10px] text-violet-800 dark:text-violet-200">
            已合并 {mergeTopics.length}
          </span>
        )}
        {dropped.length > 0 && (
          <span className="rounded-full bg-hairline/80 dark:bg-canvas/10 px-1.5 py-0.5 text-[10px] text-text-charcoal dark:text-text-stone">
            已过滤 {dropped.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editorial-decision-title"
            className="bg-canvas dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col border border-hairline-soft dark:border-border-dark"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline-soft dark:border-border-dark shrink-0">
              <h2
                id="editorial-decision-title"
                className="font-semibold text-violet-700 dark:text-violet-300"
              >
                编辑决策
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-text-stone hover:bg-surface dark:hover:bg-canvas/5"
                aria-label="关闭"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-charcoal dark:text-slate-200">
                <span>素材 {log.received} 条</span>
                {log.dedup_removed > 0 && <span>已去重 {log.dedup_removed} 条</span>}
                {dropped.length > 0 && (
                  <span className="text-text-slate">已过滤 {dropped.length} 条</span>
                )}
                {mergeTopics.length > 0 && <span>已合并 {mergeTopics.length} 组</span>}
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  主题 {outputCount} 个
                </span>
                {(log.cross_day_dropped ?? 0) > 0 && (
                  <span className="text-rose-600 dark:text-rose-300">
                    跨日丢弃 {log.cross_day_dropped}
                  </span>
                )}
                {(log.cross_day_continuation ?? 0) > 0 && (
                  <span className="text-sky-600 dark:text-sky-300">
                    续报 {log.cross_day_continuation}
                  </span>
                )}
              </div>

              {priorCoverage && (
                <p className="text-[11px] text-text-slate dark:text-text-stone">
                  {priorCoverage.summary_markdown}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {BODY_SECTIONS.map((sec) => (
                  <span
                    key={sec}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-surface dark:bg-canvas/5 text-text-charcoal dark:text-text-stone border border-hairline-soft dark:border-white/10"
                    title={sec}
                  >
                    {sec.replace(/、/g, '·').slice(0, 8)}
                    {sectionCounts[sec] > 0 ? ` ${sectionCounts[sec]}` : ''}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {priorCoverage && priorCoverage.matches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === 'prior' ? null : 'prior')}
                    className="text-[10px] px-2 py-1 rounded-full border border-sky-300/60 dark:border-sky-500/30 bg-sky-50/80 dark:bg-sky-950/20 hover:border-sky-400"
                  >
                    近 {priorCoverage.lookback_days} 日已报 ({priorCoverage.matches.length}){' '}
                    {expanded === 'prior' ? '▲' : '▼'}
                  </button>
                )}
                {headlineTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === 'headlines' ? null : 'headlines')}
                    className="text-[10px] px-2 py-1 rounded-full border border-amber-300/60 dark:border-amber-500/30 bg-surface-yellow/80 dark:bg-amber-950/20 hover:border-amber-400"
                  >
                    今日要闻 ({headlineTopics.length}) {expanded === 'headlines' ? '▲' : '▼'}
                  </button>
                )}
                {dropped.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === 'dropped' ? null : 'dropped')}
                    className="text-[10px] px-2 py-1 rounded-full border border-hairline-strong dark:border-border-dark bg-canvas dark:bg-surface-dark hover:border-violet-400"
                  >
                    已过滤 ({dropped.length}) {expanded === 'dropped' ? '▲' : '▼'}
                  </button>
                )}
                {mergeTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === 'merge' ? null : 'merge')}
                    className="text-[10px] px-2 py-1 rounded-full border border-hairline-strong dark:border-border-dark bg-canvas dark:bg-surface-dark hover:border-violet-400"
                  >
                    已合并 ({mergeTopics.length}) {expanded === 'merge' ? '▲' : '▼'}
                  </button>
                )}
              </div>

              {expanded === 'prior' && priorCoverage && (
                <ul className="max-h-48 overflow-auto space-y-1 text-[11px] text-text-charcoal dark:text-text-stone">
                  {priorCoverage.matches.map((m) => (
                    <li
                      key={`${m.index}-${m.prior_date}`}
                      className="border-l-2 border-sky-400 pl-2"
                    >
                      <span className="font-medium">#{m.index}</span> {m.kind} → {m.suggestion}
                      <span className="text-text-stone">
                        {' '}
                        ({m.prior_date}) {m.prior_headline}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {expanded === 'headlines' && headlineTopics.length > 0 && (
                <ul className="max-h-40 overflow-auto space-y-1 text-[11px] text-text-charcoal dark:text-text-stone">
                  {headlineTopics.map(renderTopicLine)}
                </ul>
              )}

              {expanded === 'dropped' && dropped.length > 0 && (
                <ul className="max-h-48 overflow-auto space-y-1 text-[11px] text-text-charcoal dark:text-text-stone">
                  {dropped.map((t) => (
                    <li key={t.topic_id} className="border-l-2 border-hairline-strong pl-2">
                      <span className="font-medium">
                        {t.headline || t.source_items?.[0]?.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {expanded === 'merge' && mergeTopics.length > 0 && (
                <ul className="max-h-48 overflow-auto space-y-1 text-[11px] text-text-charcoal dark:text-text-stone">
                  {mergeTopics.map((t) => (
                    <li key={t.topic_id} className="border-l-2 border-violet-400 pl-2">
                      <span className="font-medium">{t.headline}</span>
                      <span className="text-text-stone">
                        {' '}
                        ({t.source_items?.length ?? 0} 源)
                        {t.cluster_reason ? ` — ${t.cluster_reason}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditorialDecisionPanel;
