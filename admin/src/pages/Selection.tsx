import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { devLogger } from '../utils/devLogger';
import { deleteContent } from '../services/contentService';
import {
  getRawTimeline,
  getProcessedTimeline,
  getFeedItemDetail,
  resetScoring as apiResetScoring,
  patchScoring as apiPatchScoring,
  type FeedTimelineItem,
  type FeedItemDetail,
  type FeedSourceType,
  type FeedTopic
} from '../services/feedService';
import { runTaskNow, getSchedules, type ScheduleTask } from '../services/scheduleService';
import { useToast } from '../context/ToastContext';
import { useMessageDialog } from '../context/MessageDialogContext';
import {
  getDefaultSelectionTimeRangeInputs,
  archiveDateFromDateTimeLocal,
  getSelectionTimeRangeForArchiveDay,
  shanghaiDateKey
} from '../utils/dateUtils';
import FeedRawContentCard from './selection/FeedRawContentCard';
import FeedItemPreviewModal from './selection/FeedItemPreviewModal';
import FormDialog from '../components/UI/FormDialog';
import { getSettings } from '../services/settingsService';
import {
  FilterSelect,
  ToggleChip,
  StatPill,
  ToolbarIconButton,
  SegmentTabs
} from '../components/UI/FilterToolbar';
import { ScrollableToolbarRow, scrollablePillTabClass } from '../components/UI/ScrollablePillNav';

const SOURCE_TYPE_BADGE: Record<FeedSourceType, { label: string; cls: string }> = {
  official: {
    label: '官方',
    cls: 'bg-surface-lavender dark:bg-purple-500/15 text-ink-deep dark:text-violet-300 border-hairline-soft dark:border-purple-500/20'
  },
  kol: {
    label: 'X·KOL',
    cls: 'bg-rose-light dark:bg-rose-500/15 text-coral-dark dark:text-rose-300 border-hairline-soft dark:border-rose-500/20'
  },
  media: {
    label: '综合资讯',
    cls: 'bg-teal-light dark:bg-brand-teal/15 text-moss-dark dark:text-emerald-300 border-hairline-soft dark:border-brand-teal/20'
  },
  academic: {
    label: '学术机构',
    cls: 'bg-surface-yellow dark:bg-brand-yellow/15 text-yellow-dark dark:text-brand-yellow border-hairline-soft dark:border-brand-yellow/25'
  },
  blog: {
    label: '大咖博客',
    cls: 'bg-coral-light dark:bg-brand-coral/15 text-coral-dark dark:text-orange-300 border-hairline-soft dark:border-brand-coral/20'
  }
};

const TOPIC_LABEL: Record<FeedTopic, string> = {
  model: '模型',
  product: '产品',
  industry: '行业',
  paper: '论文',
  practice: '技巧'
};

const ScoreChip: React.FC<{ score?: number; picked?: boolean }> = ({ score, picked }) => {
  if (typeof score !== 'number') return null;
  if (picked) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-surface-yellow dark:bg-brand-yellow/15 text-yellow-dark dark:text-brand-yellow border-brand-yellow/35 dark:border-brand-yellow/25">
        <span className="material-symbols-outlined text-[12px] fill">star</span>
        精选 {score}
      </span>
    );
  }
  const tone =
    score >= 80
      ? 'bg-surface-yellow/70 dark:bg-brand-yellow/10 text-yellow-dark dark:text-brand-yellow border-brand-yellow/25'
      : score >= 60
        ? 'bg-teal-light dark:bg-brand-teal/15 text-moss-dark dark:text-emerald-300 border-hairline-soft dark:border-brand-teal/20'
        : 'bg-surface dark:bg-white/5 text-text-steel dark:text-text-secondary border-hairline-soft dark:border-white/10';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${tone}`}
    >
      {score}
    </span>
  );
};

const SourceTypeBadge: React.FC<{ type?: FeedSourceType }> = ({ type }) => {
  if (!type) return null;
  const meta = SOURCE_TYPE_BADGE[type];
  if (!meta) return null;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${meta.cls}`}>{meta.label}</span>
  );
};

const TagPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface dark:bg-white/5 text-text-slate dark:text-text-secondary border border-hairline-soft dark:border-white/10">
    {children}
  </span>
);

const TopicBadge: React.FC<{ topic: FeedTopic }> = ({ topic }) => (
  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-lavender/80 dark:bg-purple-500/15 text-ink-deep dark:text-violet-300 border border-hairline-soft dark:border-purple-500/20">
    {TOPIC_LABEL[topic]}
  </span>
);

const actionBtn =
  'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium border border-hairline-strong dark:border-white/10 text-text-charcoal dark:text-text-secondary transition-colors';
const actionBtnHover =
  'hover:border-ink hover:text-text-ink dark:hover:border-white dark:hover:text-white';
const actionBtnDanger =
  'hover:border-coral-dark hover:text-coral-dark dark:hover:border-brand-coral dark:hover:text-brand-coral';

const PAGE_SIZE = 100;

function distributeToColumns<T>(items: T[], columnCount: number): T[][] {
  const cols: T[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    cols[index % columnCount].push(item);
  });
  return cols;
}

const formatHHMM = (iso?: string) => {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '--:--';
  }
};

const toGenerationItem = (item: FeedTimelineItem) => ({
  id: item.id,
  title: item.title,
  url: item.url,
  source: item.sourceLabel || item.source,
  category: item.category || item.topic || 'feed',
  // 保留抓取时的原始描述；AI 摘要单独放在 metadata.ai_summary，避免与「描述」重复
  description: item.description || '',
  published_date: item.publishedAt,
  ingestion_date: item.ingestionDate,
  metadata: {
    content_html: item.contentHtml,
    full_content: item.fullContent,
    ai_score: item.score,
    ai_summary: item.summary,
    ai_summary_short: item.summaryShort,
    ai_recommendation: item.recommendation,
    ai_source_type: item.sourceType,
    ai_topic: item.topic,
    ai_tags: item.tags,
    ai_picked: item.picked,
    ai_related_ids: item.relatedIds
  }
});

const Selection: React.FC = () => {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm: showConfirm } = useMessageDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const rangeFromParam = searchParams.get('rangeFrom');
  const rangeToParam = searchParams.get('rangeTo');

  const resolveInitialRange = () => {
    if (rangeFromParam && rangeToParam) return { from: rangeFromParam, to: rangeToParam };
    if (dateParam) return getSelectionTimeRangeForArchiveDay(dateParam);
    return getDefaultSelectionTimeRangeInputs();
  };
  const initialRange = resolveInitialRange();

  const [activeTab, setActiveTab] = useState<'raw' | 'processed'>('raw');
  const [timeRangeFrom, setTimeRangeFrom] = useState(initialRange.from);
  const [timeRangeTo, setTimeRangeTo] = useState(initialRange.to);
  const [date, setDate] = useState(() => archiveDateFromDateTimeLocal(initialRange.to));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<FeedTimelineItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('');
  const [pickedOnly, setPickedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scoringScheduleId, setScoringScheduleId] = useState<string | null>(null);
  const [columnCount, setColumnCount] = useState(3);
  const [editScoringItem, setEditScoringItem] = useState<FeedTimelineItem | null>(null);
  const [previewDetail, setPreviewDetail] = useState<FeedItemDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imageProxy, setImageProxy] = useState('');

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth < 768) setColumnCount(1);
      else if (window.innerWidth < 1024) setColumnCount(2);
      else setColumnCount(3);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useEffect(() => {
    if (rangeFromParam) setTimeRangeFrom(rangeFromParam);
  }, [rangeFromParam]);
  useEffect(() => {
    if (rangeToParam) {
      setTimeRangeTo(rangeToParam);
      setDate(archiveDateFromDateTimeLocal(rangeToParam));
    }
  }, [rangeToParam]);

  const applyTimeRange = useCallback(
    (from: string, to: string) => {
      setTimeRangeFrom(from);
      setTimeRangeTo(to);
      const archiveDate = archiveDateFromDateTimeLocal(to);
      setDate(archiveDate);
      setSearchParams({ date: archiveDate, rangeFrom: from, rangeTo: to });
    },
    [setSearchParams]
  );

  const fetchData = useCallback(
    async (append = false, offset = 0) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      if (!append) setItems([]);
      try {
        const rangeParams = {
          date,
          rangeFrom: timeRangeFrom,
          rangeTo: timeRangeTo,
          limit: PAGE_SIZE,
          offset
        };
        let nextItems: FeedTimelineItem[] = [];
        let nextTotal = 0;
        if (activeTab === 'raw') {
          const res = await getRawTimeline(rangeParams);
          nextItems = res.items;
          nextTotal = res.total || 0;
        } else {
          const res = await getProcessedTimeline({
            ...rangeParams,
            topic: topicFilter || undefined,
            sourceType: sourceTypeFilter || undefined,
            picked: pickedOnly || undefined
          });
          nextItems = res.items;
          nextTotal = res.total || 0;
        }
        setTotalItems(nextTotal);
        setItems((prev) => {
          if (!append) return nextItems;
          const seen = new Set(prev.map((it) => it.id));
          return [...prev, ...nextItems.filter((it) => !seen.has(it.id))];
        });
      } catch (err) {
        devLogger.error('[Selection] fetch failed', err);
        if (!append) {
          setItems([]);
          setTotalItems(0);
        }
        toastError('加载失败');
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [
      activeTab,
      date,
      timeRangeFrom,
      timeRangeTo,
      topicFilter,
      sourceTypeFilter,
      pickedOnly,
      toastError
    ]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getSchedules()
      .then((list) => {
        const isScoring = (s: ScheduleTask) =>
          s.type === 'WORKFLOW' &&
          typeof s.targetId === 'string' &&
          s.targetId.includes('feed_scoring_pipeline');
        const matched = list.filter(isScoring);
        const enabled = matched.find((s: any) => s.enabled);
        setScoringScheduleId(enabled?.id || matched[0]?.id || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getSettings()
      .then((s) => setImageProxy(s.IMAGE_PROXY || ''))
      .catch(() => {});
  }, []);

  const openPreview = useCallback(
    async (item: FeedTimelineItem) => {
      setPreviewDetail({
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.sourceLabel || item.source,
        category: item.category,
        published_date: item.publishedAt,
        ingestion_date: item.ingestionDate,
        description: item.description,
        metadata: {
          content_html: item.contentHtml,
          full_content: item.fullContent
        }
      });
      setPreviewLoading(true);
      try {
        const detail = await getFeedItemDetail(item.id);
        setPreviewDetail(detail);
      } catch {
        toastError('加载预览失败');
      } finally {
        setPreviewLoading(false);
      }
    },
    [toastError]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const rawBody = it.fullContent || it.contentHtml || it.description || '';
      const hay =
        activeTab === 'raw'
          ? `${it.title} ${rawBody} ${it.source} ${it.url || ''}`.toLowerCase()
          : `${it.title} ${it.summary || ''} ${it.summaryShort || ''} ${it.source}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchQuery, activeTab]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((it) => selectedIds.has(it.id));
  const someVisibleSelected = filteredItems.some((it) => selectedIds.has(it.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredItems.map((it) => it.id)));
  };

  const groupedByDay = useMemo(() => {
    const map = new Map<string, FeedTimelineItem[]>();
    for (const it of filteredItems) {
      const d = shanghaiDateKey(it.publishedAt);
      const arr = map.get(d) || [];
      arr.push(it);
      map.set(d, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filteredItems]);

  const rawColumns = useMemo(
    () => distributeToColumns(filteredItems, columnCount),
    [filteredItems, columnCount]
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRescore = async (id: string) => {
    try {
      await apiResetScoring(id);
      if (scoringScheduleId) {
        await runTaskNow(scoringScheduleId).catch(() => {});
        toastSuccess('已重置并触发评分任务');
      } else {
        toastSuccess('已重置评分，下一次定时任务将处理');
      }
      fetchData();
    } catch {
      toastError('重置失败');
    }
  };

  const handleEditSummary = (item: FeedTimelineItem) => {
    setEditScoringItem(item);
  };

  const saveEditScoring = async (values: Record<string, string>) => {
    if (!editScoringItem) return;
    const tags = (values.tags || '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await apiPatchScoring(editScoringItem.id, {
        summaryShort: values.summaryShort,
        tags
      });
      toastSuccess('已更新');
      setEditScoringItem(null);
      fetchData();
    } catch {
      toastError('保存失败');
    }
  };

  const handleDeleteCard = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    void handleDelete(id);
  };

  const handleDelete = async (id: string) => {
    if (
      !(await showConfirm({
        title: '删除内容',
        message: '确定要删除这条内容吗？',
        confirmLabel: '删除',
        variant: 'danger',
        confirmTone: 'danger'
      }))
    )
      return;
    try {
      await deleteContent(id);
      toastSuccess('已删除');
      fetchData();
    } catch {
      toastError('删除失败');
    }
  };

  const handleGenerateNow = () => {
    if (activeTab !== 'processed') {
      toastError('请先切换到 Processed（已评分）后再生成日报');
      return;
    }
    const sel = items.filter((i) => selectedIds.has(i.id));
    if (sel.length === 0) return;
    navigate('/generation', {
      state: {
        date,
        selectedIds: sel.map((i) => i.id),
        selectedItems: sel.map(toGenerationItem)
      }
    });
  };

  const renderTimelineItem = (item: FeedTimelineItem) => {
    const checked = selectedIds.has(item.id);
    return (
      <div
        key={item.id}
        className={`group relative flex gap-4 px-5 py-4 transition-colors ${
          checked
            ? 'bg-surface-yellow/35 dark:bg-brand-yellow/5'
            : 'hover:bg-surface-soft dark:hover:bg-white/[0.02]'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggleSelected(item.id)}
          className="mt-1 h-4 w-4 rounded border-hairline-strong dark:border-border-dark text-ink dark:text-white focus:ring-ink/20"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-steel dark:text-text-secondary">
            <span className="font-mono text-[13px] font-semibold tabular-nums text-text-charcoal dark:text-white">
              {formatHHMM(item.publishedAt)}
            </span>
            <span className="truncate max-w-[12rem] sm:max-w-none">
              {item.sourceLabel || item.source}
            </span>
            <SourceTypeBadge type={item.sourceType} />
            <ScoreChip score={item.score} picked={item.picked} />
            {item.topic && <TopicBadge topic={item.topic} />}
          </div>
          {item.title && (
            <h3 className="mt-2 text-[15px] font-medium leading-snug text-text-ink dark:text-white">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h3>
          )}
          {(item.summaryShort || item.summary) && (
            <p className="mt-1.5 text-[14px] leading-relaxed text-text-slate dark:text-text-secondary line-clamp-3">
              {item.summaryShort || (item.summary || '').slice(0, 220)}
            </p>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {item.tags.slice(0, 6).map((t) => (
                <TagPill key={t}>{t}</TagPill>
              ))}
            </div>
          )}
          {item.recommendation && (
            <div className="mt-3 rounded-xl border border-brand-yellow/25 bg-surface-yellow/70 px-3 py-2 text-[12px] italic leading-relaxed text-yellow-dark dark:border-brand-yellow/20 dark:bg-brand-yellow/10 dark:text-brand-yellow">
              推荐理由：{item.recommendation}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPreview(item)}
              className={`${actionBtn} ${actionBtnHover}`}
            >
              <span className="material-symbols-outlined text-[15px]">visibility</span>
              预览
            </button>
            {(activeTab === 'processed' || item.scored) && (
              <>
                <button
                  onClick={() => handleRescore(item.id)}
                  className={`${actionBtn} ${actionBtnHover}`}
                >
                  重新评分
                </button>
                <button
                  onClick={() => handleEditSummary(item)}
                  className={`${actionBtn} ${actionBtnHover}`}
                >
                  编辑摘要/标签
                </button>
              </>
            )}
            <button
              onClick={() => handleDelete(item.id)}
              className={`${actionBtn} ${actionBtnDanger}`}
            >
              删除
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRawCardGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rawColumns.map((column, columnIndex) => (
        <div key={`raw-col-${columnIndex}`} className="flex flex-col gap-4">
          {column.map((item) => (
            <FeedRawContentCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onToggle={toggleSelected}
              onPreview={openPreview}
              onDelete={handleDeleteCard}
            />
          ))}
        </div>
      ))}
    </div>
  );

  const renderProcessedList = () => (
    <div className="overflow-hidden rounded-xl border border-hairline-soft bg-canvas shadow-subtle dark:border-white/5 dark:bg-surface-dark">
      {groupedByDay.map(([day, list]) => (
        <div key={day}>
          <div className="sticky top-0 z-[1] border-b border-hairline-soft bg-surface-soft px-5 py-2.5 dark:border-white/5 dark:bg-white/[0.04]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-steel dark:text-text-secondary">
              {day}
            </span>
          </div>
          <div className="divide-y divide-hairline-soft dark:divide-white/5">
            {list.map(renderTimelineItem)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-24 sm:space-y-8">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[32px] md:text-[40px] leading-[1.1] font-medium text-text-ink dark:text-white tracking-tight">
            内容筛选
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-slate sm:mt-2 sm:text-[15px] dark:text-text-secondary max-w-2xl">
            全部素材以信息卡片瀑布流展示；已评分页可筛选并跳转生成日报。
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-hairline bg-canvas p-2 dark:border-white/10 dark:bg-surface-dark sm:flex-row sm:items-end lg:w-auto lg:rounded-full">
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            <div className="flex min-w-0 flex-col gap-0.5 px-0.5 sm:px-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-steel dark:text-text-secondary">
                起始
              </label>
              <input
                type="datetime-local"
                step={3600}
                value={timeRangeFrom}
                onChange={(e) => applyTimeRange(e.target.value, timeRangeTo)}
                className="box-border w-full min-w-0 max-w-full bg-surface-soft text-text-ink text-[12px] rounded-full border border-hairline px-2 py-1.5 focus:outline-none focus:border-ink sm:min-w-[10.5rem] sm:text-[12.5px] sm:px-3 dark:border-white/10 dark:bg-surface-darker dark:text-white dark:focus:border-white"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 px-0.5 sm:px-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-steel dark:text-text-secondary">
                结束
              </label>
              <input
                type="datetime-local"
                step={3600}
                value={timeRangeTo}
                onChange={(e) => applyTimeRange(timeRangeFrom, e.target.value)}
                className="box-border w-full min-w-0 max-w-full bg-surface-soft text-text-ink text-[12px] rounded-full border border-hairline px-2 py-1.5 focus:outline-none focus:border-ink sm:min-w-[10.5rem] sm:text-[12.5px] sm:px-3 dark:border-white/10 dark:bg-surface-darker dark:text-white dark:focus:border-white"
              />
            </div>
          </div>
          <div className="hidden sm:block h-7 w-px bg-hairline dark:bg-white/10 self-center shrink-0" />
          <div className="relative min-w-0 w-full flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="material-symbols-outlined text-[18px] text-text-stone">search</span>
            </div>
            <input
              className="box-border w-full min-w-0 max-w-full rounded-full border-none bg-surface-soft py-2.5 pl-10 pr-3 text-[13px] text-text-ink placeholder:text-text-stone focus:outline-none focus:ring-2 focus:ring-ink/5 sm:min-w-[220px] dark:bg-surface-darker dark:text-white"
              type="text"
              placeholder="搜索标题、摘要、来源…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 min-w-0 space-y-3 bg-background-light/95 pb-4 pt-2 backdrop-blur-md dark:bg-background-dark/95">
        <div className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-hairline-soft bg-canvas p-3 dark:border-white/5 dark:bg-surface-dark sm:rounded-4xl sm:p-5">
          <div className="min-w-0">
            <SegmentTabs
              tabs={[
                { id: 'raw', label: '全部素材', icon: 'inbox' },
                { id: 'processed', label: '已评分', icon: 'auto_awesome' }
              ]}
              active={activeTab}
              onChange={(id) => {
                setActiveTab(id);
                setSelectedIds(new Set());
              }}
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-hairline-soft pt-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <ScrollableToolbarRow className="min-w-0 flex-1" innerClassName="items-center gap-2">
              {!loading && filteredItems.length > 0 && (
                <label
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline-strong bg-surface-soft px-3 py-1.5 text-[12px] font-medium text-text-charcoal transition-colors hover:border-ink dark:border-white/10 dark:bg-white/[0.03] dark:text-text-secondary dark:hover:border-white ${scrollablePillTabClass}`}
                >
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 shrink-0 rounded border-hairline-strong text-ink dark:border-border-dark dark:text-white"
                  />
                  全选当前页
                </label>
              )}
              {searchQuery.trim() ? (
                <span className={scrollablePillTabClass}>
                  <StatPill label="搜索命中" value={filteredItems.length} highlight />
                </span>
              ) : null}
              <span className={scrollablePillTabClass}>
                <StatPill label="已加载" value={items.length} />
              </span>
              <span className={scrollablePillTabClass}>
                <StatPill label="总计" value={totalItems} />
              </span>
              <span className={scrollablePillTabClass}>
                <StatPill label="已选" value={selectedIds.size} highlight={selectedIds.size > 0} />
              </span>
            </ScrollableToolbarRow>
            <ScrollableToolbarRow
              className="shrink-0 sm:w-auto"
              innerClassName="items-center justify-end gap-2"
            >
              {activeTab === 'processed' && (
                <span className={scrollablePillTabClass}>
                  <ToolbarIconButton
                    icon="refresh"
                    label="刷新列表"
                    tone="ink"
                    onClick={() => fetchData()}
                  />
                </span>
              )}
              {activeTab === 'raw' && scoringScheduleId && (
                <span className={scrollablePillTabClass}>
                  <ToolbarIconButton
                    icon="bolt"
                    label="立即评分"
                    tone="primary"
                    onClick={async () => {
                      try {
                        await runTaskNow(scoringScheduleId!);
                        toastSuccess('已触发评分任务');
                      } catch {
                        toastError('触发失败');
                      }
                    }}
                  />
                </span>
              )}
            </ScrollableToolbarRow>
          </div>

          {activeTab === 'processed' && (
            <ScrollableToolbarRow
              className="border-t border-hairline-soft pt-3 dark:border-white/5"
              innerClassName="items-end gap-3"
            >
              <div className={`shrink-0 ${scrollablePillTabClass}`}>
                <FilterSelect
                  label="话题"
                  icon="label"
                  value={topicFilter}
                  onChange={setTopicFilter}
                  options={[
                    { value: '', label: '全部话题' },
                    { value: 'model', label: '模型' },
                    { value: 'product', label: '产品' },
                    { value: 'industry', label: '行业' },
                    { value: 'paper', label: '论文' },
                    { value: 'practice', label: '技巧' }
                  ]}
                />
              </div>
              <div className={`shrink-0 ${scrollablePillTabClass}`}>
                <FilterSelect
                  label="来源类型"
                  icon="layers"
                  value={sourceTypeFilter}
                  onChange={setSourceTypeFilter}
                  options={[
                    { value: '', label: '全部来源' },
                    { value: 'official', label: '官方' },
                    { value: 'kol', label: 'X·KOL' },
                    { value: 'media', label: '综合资讯' },
                    { value: 'academic', label: '学术机构' },
                    { value: 'blog', label: '大咖博客' }
                  ]}
                />
              </div>
              <span className={`shrink-0 ${scrollablePillTabClass}`}>
                <ToggleChip
                  active={pickedOnly}
                  onClick={() => setPickedOnly((v) => !v)}
                  icon="star_outline"
                  activeIcon="star"
                  label="仅精选"
                />
              </span>
            </ScrollableToolbarRow>
          )}
        </div>
      </div>

      <div className="relative min-h-[200px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-hairline border-t-ink dark:border-white/10 dark:border-t-white" />
            <p className="text-[13px] text-text-steel dark:text-text-secondary">加载中…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-hairline-soft bg-canvas py-20 text-center text-[13px] text-text-steel dark:border-white/5 dark:bg-surface-dark dark:text-text-secondary">
            暂无内容
          </div>
        ) : activeTab === 'raw' ? (
          renderRawCardGrid()
        ) : (
          renderProcessedList()
        )}
      </div>

      {!loading && items.length < totalItems && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchData(true, items.length)}
            disabled={loadingMore}
            className="rounded-full border border-hairline-strong px-5 py-2 text-[13px] font-medium text-text-charcoal transition-colors hover:border-ink hover:text-text-ink disabled:opacity-50 dark:border-white/10 dark:text-text-secondary dark:hover:border-white dark:hover:text-white"
          >
            {loadingMore ? '加载中…' : `加载更多（${items.length}/${totalItems}）`}
          </button>
        </div>
      )}

      <FeedItemPreviewModal
        item={previewDetail}
        loading={previewLoading}
        imageProxy={imageProxy}
        onClose={() => setPreviewDetail(null)}
      />

      <FormDialog
        isOpen={!!editScoringItem}
        onClose={() => setEditScoringItem(null)}
        title="编辑摘要与标签"
        description="修改后将写入该条目的 AI 评分元数据。"
        icon="edit_note"
        confirmLabel="保存"
        fields={
          editScoringItem
            ? [
                {
                  id: 'summaryShort',
                  label: '一句话摘要',
                  defaultValue: editScoringItem.summaryShort || '',
                  placeholder: '30 字以内，用于列表展示',
                  hint: '建议简洁概括核心信息'
                },
                {
                  id: 'tags',
                  label: '标签',
                  defaultValue: (editScoringItem.tags || []).join(', '),
                  placeholder: '模型, 开源, Agent',
                  hint: '多个标签用逗号分隔'
                }
              ]
            : []
        }
        onConfirm={(values) => void saveEditScoring(values)}
      />

      <div className="fixed-overlays">
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              key="selection-bar"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-0 right-0 z-30 flex justify-center pointer-events-none px-4"
            >
              <motion.div className="bg-ink/95 dark:bg-white/95 text-white dark:text-ink shadow-modal rounded-full p-2 pl-5 pr-2 flex items-center gap-3 pointer-events-auto backdrop-blur-md max-w-2xl w-full justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow text-ink shrink-0">
                    <span className="material-symbols-outlined text-[16px] fill">checklist</span>
                  </span>
                  <span className="font-medium text-[13.5px] truncate">
                    已选择{' '}
                    <span className="text-brand-yellow tabular-nums font-semibold">
                      {selectedIds.size}
                    </span>{' '}
                    条
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[12px] font-medium text-white/70 dark:text-ink/70 hover:text-white dark:hover:text-ink px-3 py-1.5 rounded-full hover:bg-white/10 dark:hover:bg-ink/5 transition-colors"
                  >
                    清空
                  </button>
                  {activeTab === 'processed' && (
                    <button
                      type="button"
                      onClick={handleGenerateNow}
                      className="bg-brand-yellow hover:bg-brand-yellow-deep text-ink text-[13px] font-medium px-4 py-2 rounded-full flex items-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                      生成日报
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Selection;
