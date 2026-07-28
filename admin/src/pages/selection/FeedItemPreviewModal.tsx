import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ContentRenderer from '../../components/UI/LazyContentRenderer';
import { formatToShanghai } from '../../utils/dateUtils';
import type { FeedItemDetail } from '../../services/feedService';

type Props = {
  item: FeedItemDetail | null;
  loading?: boolean;
  imageProxy?: string;
  onClose: () => void;
};

const SKIP_META_KEYS = new Set([
  'description',
  'translated_title',
  'translated_description',
  'ai_summary',
  'ai_summary_short',
  'ai_recommendation',
  'ai_score',
  'ai_picked',
  'ai_topic',
  'ai_source_type',
  'ai_tags',
  'ai_related_ids',
  'ai_scored_at',
  'content_html',
  'full_content'
]);

const FeedItemPreviewModal: React.FC<Props> = ({ item, loading, imageProxy = '', onClose }) => {
  const meta = item?.metadata || {};
  const contentHtml = typeof meta.content_html === 'string' ? meta.content_html : '';
  const fullContent = typeof meta.full_content === 'string' ? meta.full_content : '';
  const description = item?.description || '';

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key="feed-preview-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[3px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-surface-dark border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="px-5 py-4 sm:px-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-start gap-3 bg-slate-50/90 dark:bg-white/[0.03]">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">原始内容预览</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {item.title || ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-9 h-9 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                aria-label="关闭"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-4">
              {loading ? (
                <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm">加载详情…</span>
                </div>
              ) : (
                <>
                  {item.url && (
                    <section className="space-y-1 pb-4 border-b border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">链接</span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all flex items-center gap-1"
                      >
                        {item.url}
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                    </section>
                  )}
                  {item.category && <MetaRow label="分类" value={item.category} />}
                  {item.source && <MetaRow label="来源" value={item.source} />}
                  {item.author && <MetaRow label="作者" value={item.author} />}
                  {item.published_date && (
                    <MetaRow label="发布时间" value={formatToShanghai(item.published_date)} />
                  )}
                  {item.ingestion_date && <MetaRow label="入库日期" value={item.ingestion_date} />}
                  {contentHtml && (
                    <RichSection label="正文" content={contentHtml} imageProxy={imageProxy} />
                  )}
                  {fullContent && !contentHtml && (
                    <RichSection label="正文" content={fullContent} imageProxy={imageProxy} />
                  )}
                  {description && !contentHtml && !fullContent && (
                    <RichSection label="描述" content={description} imageProxy={imageProxy} />
                  )}
                  {Object.entries(meta).map(([key, value]) => {
                    if (SKIP_META_KEYS.has(key) || value == null || value === '') return null;
                    if (key.startsWith('ai_')) return null;
                    return (
                      <section
                        key={key}
                        className="space-y-2 pb-4 border-b border-slate-100 dark:border-white/5 last:border-0"
                      >
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{key}</span>
                        <div className="text-sm text-slate-600 dark:text-slate-300 break-words leading-relaxed">
                          {typeof value === 'string' ? (
                            <ContentRenderer content={value} imageProxy={imageProxy} />
                          ) : (
                            <pre className="whitespace-pre-wrap font-mono text-xs bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg overflow-x-auto">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </>
              )}
            </div>

            <div className="px-5 py-3.5 sm:px-6 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2.5 bg-slate-50/70 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors"
              >
                关闭
              </button>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white bg-primary hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  查看原文
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const MetaRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <section className="space-y-1 pb-4 border-b border-slate-100 dark:border-white/5">
    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{label}</span>
    <p className="text-sm text-slate-600 dark:text-slate-300">{value}</p>
  </section>
);

const RichSection: React.FC<{ label: string; content: string; imageProxy: string }> = ({
  label,
  content,
  imageProxy
}) => (
  <section className="space-y-2 pb-4 border-b border-slate-100 dark:border-white/5 last:border-0">
    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{label}</span>
    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-none prose prose-sm dark:prose-invert">
      <ContentRenderer content={content} imageProxy={imageProxy} />
    </div>
  </section>
);

export default FeedItemPreviewModal;
