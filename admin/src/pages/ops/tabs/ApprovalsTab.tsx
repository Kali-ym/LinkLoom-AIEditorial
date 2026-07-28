import React, { useState, useEffect, useCallback } from 'react';
import { agentService } from '../../../services/agentService';
import {
  getOpsErrorMessage,
  OpsEmptyState,
  OpsErrorBanner,
  OpsRefreshButton,
  OpsTableHead,
  OpsTextAction
} from '../opsUiPrimitives';
import type {
  Agent,
  AgentRun,
  PendingHitlItem,
  PendingPermissionItem,
  PermissionHistoryItem
} from '../../../services/agentService';

interface ApprovalsTabProps {
  agents: Agent[];
  onSelectRun?: (run: AgentRun) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

const EFFECT_LABELS: Record<PermissionHistoryItem['effect'], { label: string; color: string }> = {
  allow: { label: '已批准', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  deny: { label: '已拒绝', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
};

export const ApprovalsTab: React.FC<ApprovalsTabProps> = ({ agents, onSelectRun }) => {
  const [pending, setPending] = useState<PendingPermissionItem[]>([]);
  const [pendingHitl, setPendingHitl] = useState<PendingHitlItem[]>([]);
  const [history, setHistory] = useState<PermissionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pending' | 'hitl' | 'history'>('pending');
  const [error, setError] = useState<string | null>(null);
  const pendingCountRef = React.useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingItems, hitlItems, historyItems] = await Promise.all([
        agentService.listPendingPermissions(),
        agentService.listPendingHitl(),
        agentService.listPermissionHistory(80)
      ]);
      pendingCountRef.current = pendingItems.length;
      setPending(pendingItems);
      setPendingHitl(hitlItems);
      setHistory(historyItems);
      setError(null);
    } catch (err) {
      setError(getOpsErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, pendingCountRef.current > 0 ? 4000 : 15000);
    return () => clearInterval(timer);
  }, [load]);

  const agentName = (agentId?: string) =>
    agents.find((agent) => agent.id === agentId)?.name || agentId || '-';

  const openRun = async (runId: string) => {
    if (!onSelectRun) return;
    try {
      const run = await agentService.getAgentRun(runId);
      onSelectRun(run);
    } catch (err) {
      setError(getOpsErrorMessage(err, '无法打开该次运行记录'));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-text-charcoal dark:text-text-secondary">
        记录智能体工具权限与人工确认（HITL）待办与审批历史。请在 Agent Console 对话中直接批准或拒绝。
      </p>

      {(pending.length > 0 || pendingHitl.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          有待处理项时，请打开对应智能体话题，在输入框上方的确认条中完成操作；本页仅作查看与审计。
        </div>
      )}

      {error && <OpsErrorBanner message={error} onRetry={load} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {([
            { id: 'pending' as const, label: `权限待办 (${pending.length})` },
            { id: 'hitl' as const, label: `人工确认 (${pendingHitl.length})` },
            { id: 'history' as const, label: '审批历史' }
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                view === tab.id
                  ? 'bg-ink text-white dark:bg-white dark:text-ink'
                  : 'bg-surface-soft text-text-slate hover:text-ink dark:bg-white/[0.04] dark:text-text-secondary dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <OpsRefreshButton onClick={load} disabled={loading} />
      </div>

      {loading && !error && (
        <div className="py-12 text-center text-[13px] text-text-slate dark:text-text-secondary">加载中…</div>
      )}

      {!loading && !error && view === 'pending' && pending.length === 0 && (
        <OpsEmptyState
          icon="verified_user"
          title="暂无权限待审批"
          description="智能体请求高风险工具权限时会在 Agent Console 弹出确认，并同步显示在这里。"
          iconClassName="text-accent-success"
        />
      )}

      {!loading && !error && view === 'hitl' && pendingHitl.length === 0 && (
        <OpsEmptyState
          icon="person_alert"
          title="暂无人工确认任务"
          description="工作流暂停等待你输入或确认时会出现在这里。"
          iconClassName="text-primary"
        />
      )}

      {!loading && !error && view === 'hitl' && pendingHitl.map((item) => (
        <div
          key={`${item.runId}_${item.requestId}`}
          className="rounded-xl border border-hairline bg-white p-4 dark:border-border-dark dark:bg-surface-dark"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-teal-light px-2 py-0.5 text-xs font-medium text-moss-dark dark:bg-primary/20 dark:text-primary">
                  人工确认 · {item.kind}
                </span>
                <span className="text-sm font-medium text-text-ink dark:text-white">
                  {item.runId ? `运行 #${item.runId.slice(-12)}` : '无运行记录'}
                </span>
              </div>
              {item.prompt && (
                <p className="text-xs text-text-slate dark:text-text-secondary">{item.prompt}</p>
              )}
              <p className="text-[11px] text-text-stone">
                状态 {item.runStatus} · {formatTime(item.createdAt || '')}
              </p>
            </div>
            {item.runId && (
              <OpsTextAction onClick={() => openRun(item.runId)}>打开运行详情</OpsTextAction>
            )}
          </div>
        </div>
      ))}

      {!loading && view === 'pending' && pending.map((item) => {
        const pid = item.permission.permissionId;
        return (
          <div
            key={`${item.runId}_${pid}`}
            className="rounded-xl border border-hairline bg-white p-4 dark:border-border-dark dark:bg-surface-dark"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    待审批
                  </span>
                  {item.kind === 'workflow' && (
                    <span className="inline-flex items-center rounded-full bg-surface-lavender px-2 py-0.5 text-xs font-medium text-ink-deep dark:bg-white/10 dark:text-text-secondary">
                      编排步骤
                    </span>
                  )}
                  <span className="text-sm font-medium text-text-ink dark:text-white">
                    {item.permission.subject.toolName}
                  </span>
                  {item.permission.subject.riskLevel && (
                    <span className="text-xs text-text-slate dark:text-text-secondary">
                      风险：{item.permission.subject.riskLevel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-slate dark:text-text-secondary">
                  {item.kind === 'workflow' ? (
                    <>
                      工作流：{item.workflowName || item.workflowId} · 步骤：{item.stepDisplayName || item.stepId}
                      {' · '}
                      编排 {item.workflowRunId?.slice(-12)} · {formatTime(item.permission.requestedAt)}
                    </>
                  ) : (
                    <>
                      智能体：{agentName(item.agentId)}
                      {item.workflowId && (
                        <span> · 工作流步骤 {item.stepId || '-'}</span>
                      )}
                      {' · '}
                      运行 #{item.runId?.slice(-12)} · {formatTime(item.permission.requestedAt)}
                    </>
                  )}
                </p>
                {item.permission.reason && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">请求原因：{item.permission.reason}</p>
                )}
              </div>
              {item.kind === 'agent' && item.runId && (
                <OpsTextAction onClick={() => openRun(item.runId!)}>查看运行</OpsTextAction>
              )}
            </div>

            <p className="mt-3 text-xs text-text-slate dark:text-text-secondary">
              请在 Agent Console 对应该话题中审批此工具调用。
            </p>
          </div>
        );
      })}

      {!loading && view === 'history' && (
        <div className="overflow-x-auto rounded-xl border border-hairline dark:border-border-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft bg-surface-soft/50 text-left dark:border-white/5 dark:bg-surface-dark">
                <OpsTableHead>时间</OpsTableHead>
                <OpsTableHead>工具</OpsTableHead>
                <OpsTableHead>智能体</OpsTableHead>
                <OpsTableHead>结果</OpsTableHead>
                <OpsTableHead>备注</OpsTableHead>
                <OpsTableHead>审批人</OpsTableHead>
                <OpsTableHead>运行 ID</OpsTableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline dark:divide-border-dark">
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-slate dark:text-text-secondary">
                    暂无审批历史
                  </td>
                </tr>
              )}
              {history.map((item) => {
                const effect = EFFECT_LABELS[item.effect];
                return (
                  <tr
                    key={`${item.runId}_${item.permissionId}_${item.resolvedAt}`}
                    className="hover:bg-surface-soft/40 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-xs text-text-slate dark:text-text-secondary">
                      {formatTime(item.resolvedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {item.toolName || '-'}
                      {item.kind === 'workflow' && (
                        <span className="ml-1 text-[10px] text-text-stone">编排</span>
                      )}
                    </td>
                    <td className="px-4 py-3 truncate max-w-[120px]">
                      {item.kind === 'workflow'
                        ? item.workflowId || item.workflowRunId?.slice(-8) || '-'
                        : agentName(item.agentId)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${effect.color}`}>
                        {effect.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate text-xs" title={item.reason}>
                      {item.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">{item.resolvedBy || '-'}</td>
                    <td className="px-4 py-3">
                      <OpsTextAction onClick={() => openRun(item.runId)} className="!font-mono">
                        #{item.runId.slice(-12)}
                      </OpsTextAction>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
