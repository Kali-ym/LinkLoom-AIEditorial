import React, { useEffect, useState } from 'react';
import { devLogger } from '../utils/devLogger';
import {
  getCommitHistory,
  deleteCommitHistory,
  republishCommitHistory,
  getPublicationItems,
  queryPublicationHistory,
  type CommitRecord,
  type PublicationItem,
  type PublicationHistoryQueryResult
} from '../services/historyService';
import ContentRenderer from '../components/UI/LazyContentRenderer';
import DailyReportJsonPreview, {
  type DailyReportJson
} from '../components/UI/DailyReportJsonPreview';
import { getDailyReportJson } from '../services/feedService';
import { useToast } from '../context/ToastContext.js';
import { useMessageDialog } from '../context/MessageDialogContext';

const DAILY_REPORT_JSON_PREFIX = 'daily_report_json:';

type CoverageDisplayItem = {
  key: string;
  title: string;
  section: string;
  topicId: string;
  urlNorm: string;
  importanceRank: number;
  fromJsonFallback?: boolean;
};

function resolveReportDate(commit: CommitRecord): string | null {
  const fromPath = commit.filePath?.startsWith(DAILY_REPORT_JSON_PREFIX)
    ? commit.filePath.slice(DAILY_REPORT_JSON_PREFIX.length)
    : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromPath)) return fromPath;
  const date = String(commit.date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function normalizeDailyViewUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/\/daily-json(?=\/|$|\?|#)/gi, '/daily');
}

function resolveCommitViewUrl(commit: CommitRecord): string {
  const normalized = normalizeDailyViewUrl(commit.viewUrl);
  if (normalized) return normalized;

  const date = resolveReportDate(commit);
  if (!date) return '';

  const platform = String(commit.platform ?? '')
    .toLowerCase()
    .trim();
  const isLocalSite =
    platform === 'local_site' ||
    platform === 'local site' ||
    platform === '本地站点' ||
    Boolean(commit.filePath?.startsWith(DAILY_REPORT_JSON_PREFIX));
  if (!isLocalSite) return '';

  const baseMatch = commit.viewUrl?.match(/^(https?:\/\/[^/]+\/?)/i);
  const base =
    baseMatch?.[1] || (typeof window !== 'undefined' ? `${window.location.origin}/` : '/');
  return `${base.replace(/\/?$/, '/')}daily/${date}`;
}

function parseDailyReportFromContent(content?: string): DailyReportJson | null {
  if (!content?.trim()?.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(content.trim()) as DailyReportJson;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sections)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function buildCoverageDisplayFromReport(report: DailyReportJson): CoverageDisplayItem[] {
  const items: CoverageDisplayItem[] = [];
  const seen = new Set<string>();

  const push = (params: {
    topicId: string;
    title: string;
    url?: string;
    section?: string;
    importanceRank?: number;
  }) => {
    const title = params.title.trim();
    if (!title) return;
    const urlNorm = String(params.url ?? '').trim();
    const dedupeKey = urlNorm || `${params.topicId}:${title}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    items.push({
      key: dedupeKey,
      title,
      section: params.section || '未分类',
      topicId: params.topicId,
      urlNorm,
      importanceRank: params.importanceRank ?? 999,
      fromJsonFallback: true
    });
  };

  for (const headline of report.headlines || []) {
    push({
      topicId: headline.topicId || `headline_${headline.rank}`,
      title: headline.title,
      url: headline.url,
      section: '今日要闻',
      importanceRank: headline.rank
    });
  }

  for (const section of report.sections || []) {
    for (const item of section.items || []) {
      push({
        topicId: item.topicId || `item_${items.length}`,
        title: item.title,
        url: item.url,
        section: section.title || item.section || '未分类',
        importanceRank: item.rank
      });
    }
  }

  return items;
}

const History: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm: showConfirm } = useMessageDialog();
  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [republishing, setRepublishing] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [detailCommit, setDetailCommit] = useState<CommitRecord | null>(null);
  const [publicationItems, setPublicationItems] = useState<PublicationItem[]>([]);
  const [jsonFallbackItems, setJsonFallbackItems] = useState<CoverageDisplayItem[]>([]);
  const [reportJson, setReportJson] = useState<DailyReportJson | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [testTitle, setTestTitle] = useState('');
  const [testUrl, setTestUrl] = useState('');
  const [lookbackDays, setLookbackDays] = useState(7);
  const [queryResult, setQueryResult] = useState<PublicationHistoryQueryResult | null>(null);
  const [testingCoverage, setTestingCoverage] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * pageSize;
      const res = await getCommitHistory({
        limit: pageSize,
        offset,
        search: searchQuery || undefined
      });
      setCommits(res.commits);
      setTotal(res.total);
    } catch (error) {
      devLogger.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentPage, searchQuery]);

  // 搜索时重置到第一页
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchQuery]);

  // 分页计算
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  const handleDelete = async (id: number) => {
    if (
      !(await showConfirm({
        title: '删除记录',
        message: '确定要删除这条记录吗？此操作不可恢复。',
        confirmLabel: '删除',
        variant: 'danger',
        confirmTone: 'danger'
      }))
    ) {
      return;
    }

    setDeleting(id);
    try {
      await deleteCommitHistory(id);
      // 重新获取列表
      await fetchHistory();
      toastSuccess('删除成功');
    } catch (error) {
      devLogger.error('Failed to delete:', error);
      toastError('删除失败，请重试');
    } finally {
      setDeleting(null);
    }
  };

  const handleRepublish = async (id: number) => {
    if (
      !(await showConfirm({
        title: '重新发布',
        message: '确定要重新发布这条记录吗？',
        confirmLabel: '重新发布'
      }))
    ) {
      return;
    }

    setRepublishing(id);
    try {
      await republishCommitHistory(id);
      toastSuccess('重新发布成功');
      // 重新获取列表
      await fetchHistory();
    } catch (error: any) {
      devLogger.error('Failed to republish:', error);
      toastError('重新发布失败，请重试');
    } finally {
      setRepublishing(null);
    }
  };

  const handleOpenDetail = async (commit: CommitRecord) => {
    setDetailCommit(commit);
    setPublicationItems([]);
    setJsonFallbackItems([]);
    setReportJson(null);
    setLoadingItems(true);
    try {
      const res = await getPublicationItems(commit.id);
      const items = res.items || [];
      setPublicationItems(items);

      let report: DailyReportJson | null = parseDailyReportFromContent(commit.fullContent);
      if (!report) {
        const reportDate = resolveReportDate(commit);
        if (reportDate) {
          try {
            const jsonRes = await getDailyReportJson(reportDate);
            if (jsonRes?.report && typeof jsonRes.report === 'object') {
              report = jsonRes.report as DailyReportJson;
            }
          } catch (error) {
            devLogger.error('Failed to fetch daily report JSON:', error);
          }
        }
      }
      setReportJson(report);

      if (items.length === 0 && report) {
        setJsonFallbackItems(buildCoverageDisplayFromReport(report));
      }
    } catch (error) {
      devLogger.error('Failed to fetch publication items:', error);
      toastError('加载覆盖明细失败');
    } finally {
      setLoadingItems(false);
    }
  };

  const coverageDisplayCount =
    publicationItems.length > 0 ? publicationItems.length : jsonFallbackItems.length;
  const coverageFromJsonFallback = publicationItems.length === 0 && jsonFallbackItems.length > 0;

  const handleCoverageTest = async () => {
    if (!testTitle.trim() && !testUrl.trim()) {
      toastError('请输入标题或 URL');
      return;
    }
    setTestingCoverage(true);
    setQueryResult(null);
    try {
      const res = await queryPublicationHistory({
        asOfDate: new Date().toISOString().slice(0, 10),
        lookbackDays,
        items: [{ index: 1, title: testTitle.trim(), url: testUrl.trim() }]
      });
      setQueryResult(res);
    } catch (error) {
      devLogger.error('Failed to query publication history:', error);
      toastError('覆盖规则检查失败');
    } finally {
      setTestingCoverage(false);
    }
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-text-ink dark:text-white text-[32px] sm:text-[40px] leading-[1.1] font-medium tracking-tight">
            历史存档
          </h2>
          <p className="text-text-slate dark:text-text-secondary text-[15px] mt-2 max-w-2xl">
            浏览过往日报提交记录，可重新发布或检查覆盖明细。
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <input
              className="bg-canvas dark:bg-surface-dark border border-hairline-strong dark:border-white/10 text-text-ink dark:text-white text-[13px] rounded-full pl-10 pr-10 h-10 w-full focus:ring-2 focus:ring-ink/5 focus:border-ink dark:focus:border-white outline-none transition-all placeholder:text-text-stone"
              placeholder="搜索报告..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-text-stone text-[18px]">
              search
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center text-text-stone hover:bg-surface dark:hover:bg-white/5 rounded-full transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-soft dark:bg-white/5 border-b border-hairline-soft dark:border-white/5 text-[11px] uppercase tracking-[0.06em] text-text-steel dark:text-text-secondary">
                <th className="px-6 py-4 font-semibold">日期</th>
                <th className="px-6 py-4 font-semibold">平台</th>
                <th className="px-4 py-4 font-semibold hidden sm:table-cell">提交时间</th>
                <th className="px-4 py-4 font-semibold text-center hidden md:table-cell">状态</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-slate">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-hairline border-t-ink rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : total === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-slate">
                    {searchQuery ? '未找到匹配的记录' : '暂无历史记录'}
                  </td>
                </tr>
              ) : (
                commits.map((commit) => {
                  const viewUrl = resolveCommitViewUrl(commit);
                  return (
                    <tr
                      key={commit.id}
                      className="group hover:bg-surface-soft dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4 text-[13px] text-text-charcoal dark:text-text-secondary whitespace-nowrap font-medium">
                        {commit.date}
                      </td>
                      <td className="px-6 py-4 text-[13px] text-text-ink dark:text-white">
                        <span className="chip-lavender">{commit.platform}</span>
                      </td>
                      <td className="px-4 py-4 text-[12.5px] text-text-slate dark:text-text-secondary whitespace-nowrap hidden sm:table-cell">
                        {formatDateTime(commit.commitTime)}
                      </td>
                      <td className="px-4 py-4 text-center hidden md:table-cell">
                        <span className="chip-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          已提交
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRepublish(commit.id)}
                            disabled={republishing === commit.id}
                            className="text-text-ink dark:text-white font-medium text-[11.5px] hover:bg-surface-yellow dark:hover:bg-white/5 px-3 py-1.5 rounded-full transition-colors inline-flex items-center justify-center gap-1 disabled:opacity-50"
                            title="重新发布"
                          >
                            {republishing === commit.id ? (
                              <div className="w-3 h-3 border-2 border-text-slate border-t-ink rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <span className="hidden sm:inline">重发</span>
                                <span className="material-symbols-outlined text-[14px]">
                                  refresh
                                </span>
                              </>
                            )}
                          </button>
                          {commit.fullContent && (
                            <button
                              onClick={() => setPreviewContent(commit.fullContent!)}
                              className="text-text-charcoal dark:text-text-secondary font-medium text-[11.5px] hover:bg-surface dark:hover:bg-white/5 px-3 py-1.5 rounded-full transition-colors inline-flex items-center justify-center gap-1"
                            >
                              <span className="hidden sm:inline">预览</span>
                              <span className="material-symbols-outlined text-[14px]">
                                visibility
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetail(commit)}
                            className="text-text-charcoal dark:text-text-secondary font-medium text-[11.5px] hover:bg-surface dark:hover:bg-white/5 px-3 py-1.5 rounded-full transition-colors inline-flex items-center justify-center gap-1"
                          >
                            <span className="hidden sm:inline">明细</span>
                            <span className="material-symbols-outlined text-[14px]">
                              fact_check
                            </span>
                          </button>
                          {viewUrl ? (
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text-ink dark:text-white font-medium text-[11.5px] hover:bg-teal-light dark:hover:bg-white/5 px-3 py-1.5 rounded-full transition-colors inline-flex items-center justify-center gap-1"
                            >
                              <span className="hidden sm:inline">查看</span>
                              <span className="material-symbols-outlined text-[14px]">
                                open_in_new
                              </span>
                            </a>
                          ) : (
                            <span className="text-text-stone text-[11.5px] px-3 py-1.5 inline-flex justify-center">
                              —
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(commit.id)}
                            disabled={deleting === commit.id}
                            className="text-text-stone hover:text-coral-dark hover:bg-rose-light dark:hover:bg-rose-light/10 px-2 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                            title="删除记录"
                          >
                            {deleting === commit.id ? (
                              <div className="w-4 h-4 border-2 border-coral-dark/20 border-t-coral-dark rounded-full animate-spin"></div>
                            ) : (
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-4">
          <div className="text-[12.5px] text-text-slate dark:text-text-secondary text-center sm:text-left">
            显示 {startIndex + 1} - {endIndex} 条，共 {total} 条记录
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-[12.5px] font-medium text-text-charcoal dark:text-text-secondary hover:bg-surface dark:hover:bg-white/5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              上一页
            </button>

            <div className="flex items-center gap-0.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[34px] h-[34px] px-2 text-[12.5px] font-medium rounded-full transition-colors ${
                        currentPage === page
                          ? 'bg-ink text-white dark:bg-white dark:text-ink'
                          : 'text-text-charcoal dark:text-text-secondary hover:bg-surface dark:hover:bg-white/5'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-1 text-text-stone">
                      …
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-[12.5px] font-medium text-text-charcoal dark:text-text-secondary hover:bg-surface dark:hover:bg-white/5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              下一页
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewContent !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-ink/40 backdrop-blur-sm">
          <div className="bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal w-full max-w-4xl max-h-[90vh] sm:max-h-[80vh] flex flex-col overflow-hidden border border-hairline-soft dark:border-white/5">
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-hairline-soft dark:border-white/5">
              <h3 className="text-[17px] font-medium text-text-ink dark:text-white">
                原始内容预览
              </h3>
              <button
                onClick={() => setPreviewContent(null)}
                className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:bg-surface dark:hover:bg-white/5 rounded-full transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-surface-soft dark:bg-black/20">
              <ContentRenderer
                content={previewContent || ''}
                className="text-[13.5px] text-text-charcoal dark:text-text-secondary"
              />
            </div>
            <div className="px-5 py-4 sm:px-6 border-t border-hairline-soft dark:border-white/5 flex justify-end">
              <button
                onClick={() => setPreviewContent(null)}
                className="px-5 py-2.5 bg-ink text-white dark:bg-white dark:text-ink rounded-full text-[13px] font-medium hover:bg-charcoal dark:hover:bg-slate-100 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {detailCommit && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink/40 backdrop-blur-sm">
          <div className="bg-canvas dark:bg-surface-dark shadow-modal w-full max-w-3xl h-full flex flex-col border-l border-hairline-soft dark:border-white/5">
            <div className="px-6 py-5 border-b border-hairline-soft dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-[20px] font-medium text-text-ink dark:text-white tracking-tight">
                  发布历史详情
                </h3>
                <p className="text-[12.5px] text-text-slate mt-1">
                  {detailCommit.date} · {detailCommit.platform}
                </p>
              </div>
              <button
                onClick={() => setDetailCommit(null)}
                className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:bg-surface dark:hover:bg-white/5 rounded-full transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <section className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-4 rounded-2xl bg-surface-soft dark:bg-black/20 border border-hairline-soft dark:border-white/5">
                  <div className="text-[10.5px] text-text-steel uppercase tracking-[0.06em] font-semibold mb-1.5">
                    文件路径 / 媒体 ID
                  </div>
                  <div className="text-[13px] text-text-ink dark:text-slate-200 break-all">
                    {detailCommit.filePath || '无'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-surface-soft dark:bg-black/20 border border-hairline-soft dark:border-white/5">
                  <div className="text-[10.5px] text-text-steel uppercase tracking-[0.06em] font-semibold mb-1.5">
                    提交时间
                  </div>
                  <div className="text-[13px] text-text-ink dark:text-slate-200">
                    {formatDateTime(detailCommit.commitTime)}
                  </div>
                </div>
                <div className="md:col-span-2 p-4 rounded-2xl bg-surface-soft dark:bg-black/20 border border-hairline-soft dark:border-white/5">
                  <div className="text-[10.5px] text-text-steel uppercase tracking-[0.06em] font-semibold mb-1.5">
                    标题
                  </div>
                  <div className="text-[13px] text-text-ink dark:text-slate-200">
                    {detailCommit.commitMessage || '无'}
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[15px] font-medium text-text-ink dark:text-white">
                    报道覆盖明细
                  </h4>
                  <span className="chip-neutral">{coverageDisplayCount} 条</span>
                </div>
                {coverageFromJsonFallback && (
                  <p className="mb-3 text-[12px] text-text-slate dark:text-text-secondary">
                    覆盖索引尚未写入，以下条目来自 JSON 日报。可在「设置 →
                    跨日覆盖」中执行回填，或重新提交以持久化。
                  </p>
                )}
                <div className="rounded-2xl border border-hairline-soft dark:border-white/5 overflow-hidden">
                  {loadingItems ? (
                    <div className="p-8 text-center text-text-stone">加载中...</div>
                  ) : publicationItems.length === 0 && jsonFallbackItems.length === 0 ? (
                    <div className="p-8 text-center text-text-stone">
                      暂无覆盖明细，可从设置页或接口回填
                    </div>
                  ) : publicationItems.length > 0 ? (
                    <div className="divide-y divide-hairline-soft dark:divide-white/5">
                      {publicationItems.map((item) => (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-[13.5px] text-text-ink dark:text-white break-words">
                                {item.title || '未命名主题'}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span className="chip-neutral">{item.section || '未分类'}</span>
                                <span className="chip-neutral">重要度 {item.importanceRank}</span>
                                <span className="text-text-stone">{item.topicId}</span>
                              </div>
                            </div>
                          </div>
                          {item.urlNorm && (
                            <div className="mt-2 text-[12px] text-ink-deep dark:text-white break-all">
                              {item.urlNorm}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="divide-y divide-hairline-soft dark:divide-white/5">
                      {jsonFallbackItems.map((item) => (
                        <div key={item.key} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-[13.5px] text-text-ink dark:text-white break-words">
                                {item.title}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span className="chip-neutral">{item.section}</span>
                                <span className="chip-neutral">重要度 {item.importanceRank}</span>
                                <span className="chip-lavender">JSON</span>
                                <span className="text-text-stone">{item.topicId}</span>
                              </div>
                            </div>
                          </div>
                          {item.urlNorm && (
                            <div className="mt-2 text-[12px] text-ink-deep dark:text-white break-all">
                              {item.urlNorm}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {reportJson && (
                <section>
                  <h4 className="text-[15px] font-medium text-text-ink dark:text-white mb-3">
                    JSON 日报预览
                  </h4>
                  <div className="rounded-3xl border border-hairline-soft dark:border-white/5 p-4 sm:p-5 bg-surface-soft/50 dark:bg-black/20">
                    <DailyReportJsonPreview report={reportJson} />
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-hairline-soft dark:border-white/5 p-5">
                <h4 className="text-[15px] font-medium text-text-ink dark:text-white mb-3">
                  覆盖规则检查
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px] gap-3">
                  <input
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="输入候选标题"
                    className="px-4 py-2.5 rounded-full border border-hairline-strong dark:border-white/10 bg-canvas dark:bg-black/20 text-[13px] text-text-ink dark:text-white outline-none focus:border-ink dark:focus:border-white placeholder:text-text-stone"
                  />
                  <input
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="输入候选 URL"
                    className="px-4 py-2.5 rounded-full border border-hairline-strong dark:border-white/10 bg-canvas dark:bg-black/20 text-[13px] text-text-ink dark:text-white outline-none focus:border-ink dark:focus:border-white placeholder:text-text-stone"
                  />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={lookbackDays}
                    onChange={(e) => setLookbackDays(parseInt(e.target.value) || 7)}
                    className="px-4 py-2.5 rounded-full border border-hairline-strong dark:border-white/10 bg-canvas dark:bg-black/20 text-[13px] text-text-ink dark:text-white outline-none focus:border-ink dark:focus:border-white"
                  />
                </div>
                <button
                  onClick={handleCoverageTest}
                  disabled={testingCoverage}
                  className="mt-4 btn-pill-cta px-5 py-2.5 disabled:opacity-100"
                >
                  {testingCoverage ? '检测中...' : '检测覆盖命中'}
                </button>
                {queryResult && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[13px] text-text-charcoal dark:text-slate-300">
                      {queryResult.summary}
                    </p>
                    {queryResult.matches.length === 0 ? (
                      <div className="text-[13px] text-moss-dark dark:text-teal-300 px-4 py-3 rounded-2xl bg-teal-light dark:bg-teal-light/10">
                        未命中历史覆盖。
                      </div>
                    ) : (
                      queryResult.matches.map((match, index) => (
                        <div
                          key={index}
                          className="p-4 rounded-2xl bg-surface-yellow dark:bg-yellow-500/10 text-sm border border-brand-yellow/30"
                        >
                          <div className="font-medium text-yellow-dark dark:text-yellow-300 text-[13px]">
                            {match.kind} · 建议 {match.suggestion}
                            {typeof match.score === 'number'
                              ? ` · ${(match.score * 100).toFixed(1)}%`
                              : ''}
                          </div>
                          <div className="mt-1.5 text-[13px] text-text-ink dark:text-slate-200">
                            {match.prior_date}：{match.prior_headline || '未命名历史主题'}
                          </div>
                          {match.history_id && (
                            <div className="mt-1 text-[11px] text-text-stone">
                              历史记录 ID：{match.history_id}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
