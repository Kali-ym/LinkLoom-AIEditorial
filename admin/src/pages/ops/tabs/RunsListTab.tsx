import React, { useState, useEffect, useCallback } from 'react';
import { agentService } from '../../../services/agentService';
import {
  getOpsErrorMessage,
  opsInputClass,
  opsSelectClass,
  OpsErrorBanner,
  OpsRefreshButton,
  OpsTableHead
} from '../opsUiPrimitives';
import type {
  AgentRun,
  AgentRunFilter,
  AgentRunPage,
  AgentRunSource,
  AgentRunStatus,
  Agent
} from '../../../services/agentService';

const STATUS_LABELS: Record<AgentRunStatus, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200' },
  running: { label: '运行中', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  paused: { label: '已暂停', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  cancelling: { label: '取消中', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  succeeded: { label: '成功', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  archived: { label: '已归档', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
};

const STATUS_OPTIONS: AgentRunStatus[] = ['queued', 'running', 'paused', 'cancelling', 'succeeded', 'failed', 'cancelled', 'archived'];

const SOURCE_LABELS: Record<AgentRunSource, string> = {
  agent: '智能体',
  workflow: '工作流',
  builder: '构建器',
  eval: '评测',
  scheduler: '调度',
  api: 'API',
};

const SOURCE_OPTIONS: AgentRunSource[] = ['agent', 'workflow', 'builder', 'eval', 'scheduler', 'api'];

type RunQuickFilter = 'all' | 'active' | 'pendingPermission' | 'failed' | 'paused';

const QUICK_FILTERS: Array<{ id: RunQuickFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'active', label: '活跃' },
  { id: 'pendingPermission', label: '待审批' },
  { id: 'failed', label: '失败' },
  { id: 'paused', label: '已暂停' },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms?: number): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

function toIsoFromLocalDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

interface RunsListTabProps {
  agents: Agent[];
  onSelectRun?: (run: AgentRun) => void;
  initialQuickFilter?: RunQuickFilter;
  initialAgentFilter?: string;
  onClearUrlFilters?: () => void;
}

export const RunsListTab: React.FC<RunsListTabProps> = ({
  agents,
  onSelectRun,
  initialQuickFilter = 'all',
  initialAgentFilter = '',
  onClearUrlFilters
}) => {
  const [page, setPage] = useState<AgentRunPage>({ items: [], total: 0, offset: 0, limit: 30 });
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<RunQuickFilter>(initialQuickFilter);
  const [statusFilter, setStatusFilter] = useState<AgentRunStatus | ''>('');
  const [agentFilter, setAgentFilter] = useState(initialAgentFilter);

  useEffect(() => {
    setAgentFilter(initialAgentFilter);
  }, [initialAgentFilter]);

  const [sourceFilter, setSourceFilter] = useState<AgentRunSource | ''>('');
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasAdvancedFilters = Boolean(
    statusFilter || sourceFilter || agentFilter || createdAfter || createdBefore
  );

  useEffect(() => {
    setQuickFilter(initialQuickFilter);
  }, [initialQuickFilter]);

  const buildFilter = useCallback(
    (overrides?: {
      search?: string;
      quickFilter?: RunQuickFilter;
      statusFilter?: AgentRunStatus | '';
      agentFilter?: string;
      sourceFilter?: AgentRunSource | '';
      createdAfter?: string;
      createdBefore?: string;
    }): AgentRunFilter => {
      const nextSearch = overrides?.search ?? search;
      const nextQuickFilter = overrides?.quickFilter ?? quickFilter;
      const nextStatusFilter = overrides?.statusFilter ?? statusFilter;
      const nextAgentFilter = overrides?.agentFilter ?? agentFilter;
      const nextSourceFilter = overrides?.sourceFilter ?? sourceFilter;
      const nextCreatedAfter = overrides?.createdAfter ?? createdAfter;
      const nextCreatedBefore = overrides?.createdBefore ?? createdBefore;

      const f: AgentRunFilter = {};
      const fromIso = toIsoFromLocalDateTime(nextCreatedAfter);
      const toIso = toIsoFromLocalDateTime(nextCreatedBefore);

      if (nextSearch.trim()) f.search = nextSearch.trim();
      if (nextAgentFilter) f.agentId = nextAgentFilter;
      if (nextSourceFilter) f.source = nextSourceFilter;
      if (fromIso) f.createdAfter = fromIso;
      if (toIso) f.createdBefore = toIso;

      if (nextQuickFilter === 'active') f.status = ['queued', 'running', 'paused', 'cancelling'];
      if (nextQuickFilter === 'pendingPermission') f.pendingPermission = true;
      if (nextQuickFilter === 'failed') f.status = 'failed';
      if (nextQuickFilter === 'paused') f.status = 'paused';
      if (nextStatusFilter) f.status = nextStatusFilter;

      return f;
    },
    [search, quickFilter, statusFilter, agentFilter, sourceFilter, createdAfter, createdBefore]
  );

  const load = useCallback(
    async (offset = 0, filterOverrides?: Parameters<typeof buildFilter>[0]) => {
      setLoading(true);
      try {
        const result = await agentService.listAgentRuns(buildFilter(filterOverrides), offset, 30);
        setPage(result);
        setError(null);
      } catch (err) {
        setError(getOpsErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [buildFilter]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  useEffect(() => {
    const hasActive = page.items.some((r) => ['queued', 'running', 'paused', 'cancelling'].includes(r.status));
    if (!hasActive) return;
    const timer = setInterval(() => load(page.offset), 4000);
    return () => clearInterval(timer);
  }, [page, load]);

  const handlePrev = () => {
    if (page.offset > 0) void load(Math.max(0, page.offset - page.limit));
  };
  const handleNext = () => {
    if (page.offset + page.limit < page.total) void load(page.offset + page.limit);
  };

  const handleClearAdvancedFilters = () => {
    setStatusFilter('');
    setAgentFilter('');
    setSourceFilter('');
    setCreatedAfter('');
    setCreatedBefore('');
    onClearUrlFilters?.();
    void load(0, {
      statusFilter: '',
      agentFilter: '',
      sourceFilter: '',
      createdAfter: '',
      createdBefore: ''
    });
  };

  const handleResetAllFilters = () => {
    setSearch('');
    setQuickFilter('all');
    setStatusFilter('');
    setAgentFilter('');
    setSourceFilter('');
    setCreatedAfter('');
    setCreatedBefore('');
    onClearUrlFilters?.();
    void load(0, {
      search: '',
      quickFilter: 'all',
      statusFilter: '',
      agentFilter: '',
      sourceFilter: '',
      createdAfter: '',
      createdBefore: ''
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-text-charcoal dark:text-text-secondary">
        智能体与工作流的每次执行记录。运行 ID 为任务唯一标识。
      </p>

      {error && <OpsErrorBanner message={error} onRetry={() => load(page.offset)} />}

      <div className="space-y-3 rounded-2xl border border-hairline-soft bg-canvas p-3 dark:border-white/5 dark:bg-surface-dark">
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((item) => {
            const selected = quickFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setQuickFilter(item.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-ink text-white dark:bg-white dark:text-ink'
                    : 'bg-surface-soft text-text-slate hover:text-ink dark:bg-white/[0.04] dark:text-text-secondary dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="搜索运行 ID、会话 ID 或智能体…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load(0);
            }}
            className={`min-w-0 flex-1 ${opsInputClass}`}
          />
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => load(0)} className="btn-pill-primary !text-sm !py-2">
              搜索
            </button>
            <OpsRefreshButton onClick={() => load(page.offset)} disabled={loading} />
          </div>
        </div>

        <details className="group" open={hasAdvancedFilters ? true : undefined}>
          <summary className="cursor-pointer list-none text-[13px] font-medium text-text-charcoal dark:text-text-secondary [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-90">
                chevron_right
              </span>
              高级筛选
              {hasAdvancedFilters && (
                <span className="rounded-full bg-surface-yellow px-2 py-0.5 text-[11px] font-medium text-yellow-dark">
                  已启用
                </span>
              )}
            </span>
          </summary>
          <div className="mt-3 space-y-3 border-t border-hairline-soft pt-3 dark:border-white/5">
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AgentRunStatus | '')}
                className={opsSelectClass}
              >
                <option value="">全部状态</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s].label}
                  </option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as AgentRunSource | '')}
                className={opsSelectClass}
              >
                <option value="">全部触发来源</option>
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className={opsSelectClass}
              >
                <option value="">全部智能体</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-[12px] text-text-charcoal dark:text-text-secondary">
                起始时间
                <input
                  type="datetime-local"
                  value={createdAfter}
                  onChange={(e) => setCreatedAfter(e.target.value)}
                  className={`min-w-0 flex-1 ${opsInputClass}`}
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-text-charcoal dark:text-text-secondary">
                结束时间
                <input
                  type="datetime-local"
                  value={createdBefore}
                  onChange={(e) => setCreatedBefore(e.target.value)}
                  className={`min-w-0 flex-1 ${opsInputClass}`}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void load(0)} className="btn-pill-primary !text-xs !py-1.5">
                应用高级筛选
              </button>
              <button
                type="button"
                onClick={handleClearAdvancedFilters}
                className="btn-pill-secondary !text-xs !py-1.5"
              >
                清除高级条件
              </button>
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="btn-pill-ghost !text-xs !py-1.5"
              >
                重置全部筛选
              </button>
            </div>
          </div>
        </details>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-hairline-soft dark:border-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline-soft bg-surface-soft/50 text-left dark:border-white/5 dark:bg-surface-dark">
              <OpsTableHead>运行 ID</OpsTableHead>
              <OpsTableHead>智能体</OpsTableHead>
              <OpsTableHead>触发来源</OpsTableHead>
              <OpsTableHead>状态</OpsTableHead>
              <OpsTableHead>轮次</OpsTableHead>
              <OpsTableHead>工具调用</OpsTableHead>
              <OpsTableHead>耗时</OpsTableHead>
              <OpsTableHead>开始时间</OpsTableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline dark:divide-border-dark">
            {loading && (
              <tr><td colSpan={8} className="py-12 text-center text-text-slate dark:text-text-secondary">加载中...</td></tr>
            )}
            {!loading && !error && page.items.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-text-charcoal dark:text-text-secondary">没有符合筛选条件的运行记录</td></tr>
            )}
            {!loading && page.items.map((run) => {
              const agentName = agents.find((a) => a.id === run.agentId)?.name || run.agentId || '-';
              const status = STATUS_LABELS[run.status] || STATUS_LABELS.cancelled;
              return (
                <tr
                  key={run.runId}
                  className="cursor-pointer hover:bg-surface-soft/40 dark:hover:bg-white/[0.03] transition-colors"
                  onClick={() => onSelectRun?.(run)}
                >
                  <td className="px-4 py-3 font-mono text-xs truncate max-w-[160px]" title={run.runId}>{run.runId.slice(-12)}</td>
                  <td className="px-4 py-3 truncate max-w-[140px]">{agentName}</td>
                  <td className="px-4 py-3">{SOURCE_LABELS[run.source] ?? run.source}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{run.roundCount}</td>
                  <td className="px-4 py-3 text-center">{run.toolCallCount}</td>
                  <td className="px-4 py-3">{formatDuration(run.durationMs)}</td>
                  <td className="px-4 py-3 text-xs text-text-slate dark:text-text-secondary">{formatTime(run.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {page.total > page.limit && (
        <div className="flex items-center justify-between text-sm text-text-slate dark:text-text-secondary">
          <span>共 {page.total} 条，当前 {page.offset + 1}-{Math.min(page.offset + page.limit, page.total)}</span>
          <div className="flex gap-2">
            <button onClick={handlePrev} disabled={page.offset === 0} className="btn-pill-secondary !text-xs !py-1.5 disabled:opacity-40">上一页</button>
            <button onClick={handleNext} disabled={page.offset + page.limit >= page.total} className="btn-pill-secondary !text-xs !py-1.5 disabled:opacity-40">下一页</button>
          </div>
        </div>
      )}
    </div>
  );
};
