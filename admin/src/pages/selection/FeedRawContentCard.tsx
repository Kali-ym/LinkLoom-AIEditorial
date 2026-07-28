import React, { memo } from 'react';
import type { FeedTimelineItem } from '../../services/feedService';
import { formatToShanghai } from '../../utils/dateUtils';

const CATEGORY_STYLE: Record<string, string> = {
  githubtrending: 'bg-ink text-white border-ink dark:bg-white/10 dark:text-white dark:border-white/10',
  news: 'bg-teal-light dark:bg-brand-teal/15 text-moss-dark dark:text-emerald-300 border-hairline-soft dark:border-brand-teal/20',
  paper: 'bg-surface-lavender dark:bg-purple-500/15 text-ink-deep dark:text-violet-300 border-hairline-soft dark:border-purple-500/20',
  social: 'bg-surface dark:bg-white/5 text-text-slate dark:text-text-secondary border-hairline-soft dark:border-white/10',
  socialmedia: 'bg-surface dark:bg-white/5 text-text-slate dark:text-text-secondary border-hairline-soft dark:border-white/10',
  history: 'bg-surface-yellow dark:bg-brand-yellow/15 text-yellow-dark dark:text-brand-yellow border-brand-yellow/25',
  feed: 'bg-coral-light dark:bg-brand-coral/15 text-coral-dark dark:text-orange-300 border-hairline-soft dark:border-brand-coral/20',
  rss: 'bg-brand-orange-light dark:bg-orange-500/15 text-coral-dark dark:text-orange-300 border-hairline-soft dark:border-orange-500/20'
};

const CATEGORY_ICON: Record<string, string> = {
  githubtrending: 'code',
  news: 'newspaper',
  paper: 'school',
  social: 'forum',
  socialmedia: 'forum',
  history: 'archive',
  feed: 'article',
  rss: 'rss_feed'
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function pickRawBody(item: Pick<FeedTimelineItem, 'fullContent' | 'contentHtml' | 'description'>): string {
  const raw = item.fullContent || item.contentHtml || item.description || '';
  return stripHtml(raw);
}

type Props = {
  item: FeedTimelineItem;
  selected: boolean;
  onToggle: (id: string) => void;
  onPreview: (item: FeedTimelineItem) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
};

const iconBtn =
  'flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-canvas text-text-stone transition-colors dark:border-white/10 dark:bg-white/5 dark:text-text-secondary';

const FeedRawContentCard = memo(({ item, selected, onToggle, onPreview, onDelete }: Props) => {
  const cat = (item.category || 'feed').toLowerCase();
  const typeStyle = CATEGORY_STYLE[cat] || CATEGORY_STYLE.feed;
  const typeIcon = CATEGORY_ICON[cat] || 'public';
  const rawBody = pickRawBody(item);

  return (
    <div
      onClick={() => onToggle(item.id)}
      className={`group relative cursor-pointer rounded-4xl border p-5 transition-all duration-200 ease-out ${
        selected
          ? 'border-ink/20 bg-surface-yellow/25 shadow-card ring-1 ring-brand-yellow/25 dark:border-brand-yellow/30 dark:bg-brand-yellow/5 dark:ring-brand-yellow/15'
          : 'border-hairline-soft bg-canvas shadow-subtle hover:border-hairline-strong hover:shadow-card dark:border-white/5 dark:bg-surface-dark dark:hover:border-white/10'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="h-5 w-5 cursor-pointer rounded border-hairline-strong text-ink focus:ring-ink/20 dark:border-border-dark dark:bg-background-dark dark:text-white"
        />
        <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${typeStyle}`}>
          <span className="material-symbols-outlined text-sm">{typeIcon}</span>
          {(item.category || 'feed').toUpperCase()}
        </span>
      </div>

      <h3
        className={`mb-2 line-clamp-3 break-words text-[17px] font-medium leading-snug transition-colors ${
          selected ? 'text-text-ink dark:text-brand-yellow' : 'text-text-ink group-hover:text-charcoal dark:text-white dark:group-hover:text-brand-yellow'
        }`}
      >
        {item.title}
      </h3>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-stone dark:text-text-secondary">
        {(item.sourceLabel || item.source) && (
          <span className="flex max-w-full items-center gap-1 truncate">
            <span className="material-symbols-outlined flex-shrink-0 text-xs">hub</span>
            <span className="truncate">{item.sourceLabel || item.source}</span>
          </span>
        )}
        {item.publishedAt && (
          <span className="flex max-w-full items-center gap-1 truncate" title="发布时间 (上海)">
            <span className="material-symbols-outlined flex-shrink-0 text-xs">schedule</span>
            <span className="truncate">{formatToShanghai(item.publishedAt)}</span>
          </span>
        )}
        {item.ingestionDate && (
          <span className="flex max-w-full items-center gap-1 truncate" title="入库日期">
            <span className="material-symbols-outlined flex-shrink-0 text-xs">inventory_2</span>
            <span className="truncate">{item.ingestionDate}</span>
          </span>
        )}
      </div>

      {item.url && (
        <p className="mb-3 line-clamp-2 break-all text-[12px] text-text-stone dark:text-text-secondary">{item.url}</p>
      )}

      {rawBody ? (
        <p className="mb-4 line-clamp-4 break-words text-[14px] leading-relaxed text-text-slate dark:text-text-secondary">
          {rawBody}
        </p>
      ) : (
        <p className="mb-4 text-[13px] italic text-text-stone dark:text-text-secondary">暂无原始正文</p>
      )}

      <div className="flex h-12 flex-shrink-0 items-center justify-between border-t border-hairline-soft pt-3 dark:border-white/5">
        <div className="flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}
            className={`${iconBtn} hover:border-ink hover:text-text-ink dark:hover:border-white dark:hover:text-white`}
            title="预览"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
          </button>
          <button
            type="button"
            onClick={(e) => onDelete(e, item.id)}
            className={`${iconBtn} ml-2 hover:border-coral-dark hover:text-coral-dark dark:hover:border-brand-coral dark:hover:text-brand-coral`}
            title="删除该条内容"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`${iconBtn} hover:border-ink hover:text-text-ink dark:hover:border-white dark:hover:text-white`}
            title="打开链接"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </a>
        )}
      </div>
    </div>
  );
});

FeedRawContentCard.displayName = 'FeedRawContentCard';

export default FeedRawContentCard;
