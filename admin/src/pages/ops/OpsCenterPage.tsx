import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { devLogger } from '../../utils/devLogger';
import { agentService } from '../../services/agentService';
import type {
  Agent,
  AgentRun,
  AgentRunReplayResult,
  AgentRunMetrics,
  AgentRunAlert,
  PendingPermissionItem,
  Workflow
} from '../../services/agentService';
import { useToast } from '../../context/ToastContext';
import OpsCenterPageShell from './OpsCenterPageShell';
import OpsKpiBar from './components/OpsKpiBar';
import { HealthTab } from './tabs/HealthTab';
import { RunsTab } from './tabs/RunsTab';
import { ApprovalsTab } from './tabs/ApprovalsTab';

import { PlatformOpsTab } from './tabs/platform/PlatformOpsTab';
import { RagOpsTab } from './tabs/rag/RagOpsTab';
import { RunDetailPanel } from '../agents/tabs/RunDetailPanel';
import { ReplayComparePanel } from '../agents/tabs/ReplayComparePanel';
import { getOpsErrorMessage, OpsErrorBanner } from './opsUiPrimitives';

const VALID_TABS = ['health', 'runs', 'inbox', 'rag', 'platform'] as const;
type OpsTabId = (typeof VALID_TABS)[number];

function parseTab(value: string | null): OpsTabId {
  if (value && VALID_TABS.includes(value as OpsTabId)) return value as OpsTabId;
  return 'health';
}

const OpsCenterPage: React.FC = () => {
  const { success: toastSuccess } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [metrics, setMetrics] = useState<AgentRunMetrics | null>(null);
  const [alerts, setAlerts] = useState<AgentRunAlert[]>([]);
  const [pending, setPending] = useState<PendingPermissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [replayResult, setReplayResult] = useState<AgentRunReplayResult | null>(null);
  const [runsQuickFilter, setRunsQuickFilter] = useState<'all' | 'active' | 'pendingPermission' | 'failed' | 'paused'>('all');
  const [runDeepLinkError, setRunDeepLinkError] = useState<string | null>(null);
  const pendingCountRef = useRef(0);

  const loadBaseData = useCallback(async () => {
    try {
      const [agentsData, workflowsData] = await Promise.all([
        agentService.getAgents(),
        agentService.getWorkflows()
      ]);
      setAgents(agentsData);
      setWorkflows(workflowsData);
      setLoadError(null);
    } catch (err) {
      devLogger.error('Failed to load ops center base data:', err);
      setLoadError(getOpsErrorMessage(err, '无法加载运营中心基础数据'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOpsData = useCallback(async () => {
    try {
      const [metricsData, alertsData, pendingData] = await Promise.all([
        agentService.getAgentRunMetrics(),
        agentService.getAgentRunAlerts(),
        agentService.listPendingPermissions()
      ]);
      setMetrics(metricsData);
      setAlerts(alertsData);
      pendingCountRef.current = pendingData.length;
      setPending(pendingData);
    } catch (err) {
      devLogger.warn('Failed to load ops live data:', err);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
    loadOpsData();
    const timer = setInterval(loadOpsData, pendingCountRef.current > 0 ? 5000 : 30000);
    return () => clearInterval(timer);
  }, [loadBaseData, loadOpsData]);

  useEffect(() => {
    const runId = searchParams.get('runId');
    if (!runId) {
      setRunDeepLinkError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const run = await agentService.getAgentRun(runId);
        if (!cancelled) {
          setSelectedRun(run);
          setRunDeepLinkError(null);
        }
      } catch (err) {
        devLogger.error('Failed to open run from URL:', err);
        if (!cancelled) {
          setRunDeepLinkError(getOpsErrorMessage(err, `无法打开运行记录 ${runId}`));
          setSelectedRun(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  const pendingCount = pending.length;

  const tabs = useMemo(
    () => [
      { id: 'health', label: '健康', icon: 'monitoring' },
      { id: 'runs', label: '运行', icon: 'play_circle' },
      {
        id: 'inbox',
        label: pendingCount > 0 ? `待办 (${pendingCount})` : '待办',
        icon: 'verified_user'
      },
      { id: 'rag', label: '知识检索', icon: 'manage_search' },
      { id: 'platform', label: '平台', icon: 'shield' }
    ],
    [pendingCount]
  );

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'health') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleNavigateTab = (tab: string, options?: { runsQuickFilter?: typeof runsQuickFilter }) => {
    if (options?.runsQuickFilter) setRunsQuickFilter(options.runsQuickFilter);
    handleTabChange(tab);
  };

  const handleSelectRun = useCallback(
    (run: AgentRun) => {
      setSelectedRun(run);
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'runs');
      next.set('runId', run.runId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return (
    <>
      <OpsCenterPageShell
        tabs={tabs}
        activeTab={activeTab}
        isLoading={isLoading}
        onTabChange={handleTabChange}
        subtitle={activeTab === 'platform' ? 'Agent 治理、来源质量门禁与回归验证。' : undefined}
      >
        <>
          {loadError && (
            <OpsErrorBanner message={loadError} onRetry={loadBaseData} className="mb-4" />
          )}
          {runDeepLinkError && (
            <OpsErrorBanner
              message={runDeepLinkError}
              retryLabel="返回运行列表"
              onRetry={() => {
                setRunDeepLinkError(null);
                const next = new URLSearchParams(searchParams);
                next.delete('runId');
                next.set('tab', 'runs');
                setSearchParams(next, { replace: true });
              }}
              className="mb-4"
            />
          )}

          {activeTab === 'health' && (
            <>
              <OpsKpiBar
                data={{ metrics, pending, alertCount: alerts.length }}
                onNavigateInbox={() => handleTabChange('inbox')}
                onNavigateRag={() => handleTabChange('rag')}
              />
              <HealthTab
                agents={agents}
                metrics={metrics}
                alerts={alerts}
                pending={pending}
                onSelectRun={handleSelectRun}
                onNavigateTab={handleNavigateTab}
                onNavigateAgentConsole={() => { window.location.assign('/console'); }}
              />
            </>
          )}
          {activeTab === 'runs' && (
            <RunsTab
              agents={agents}
              workflows={workflows}
              onSelectRun={handleSelectRun}
              initialQuickFilter={runsQuickFilter}
              initialAgentFilter={searchParams.get('agentId') || ''}
            />
          )}
          {activeTab === 'inbox' && (
            <ApprovalsTab agents={agents} onSelectRun={handleSelectRun} />
          )}
          {activeTab === 'rag' && <RagOpsTab />}
          {activeTab === 'platform' && <PlatformOpsTab agents={agents} />}
        </>
      </OpsCenterPageShell>

      {selectedRun && (
        <RunDetailPanel
          run={selectedRun}
          onClose={() => {
            setSelectedRun(null);
            const next = new URLSearchParams(searchParams);
            next.delete('runId');
            setSearchParams(next, { replace: true });
          }}
          onApprove={async (pid, reason) => {
            await agentService.approveRunPermission(selectedRun.runId, pid, reason);
            const refreshed = await agentService.getAgentRun(selectedRun.runId);
            setSelectedRun(refreshed);
            toastSuccess('已批准权限请求');
            void loadOpsData();
          }}
          onReject={async (pid, reason) => {
            await agentService.rejectRunPermission(selectedRun.runId, pid, reason);
            const refreshed = await agentService.getAgentRun(selectedRun.runId);
            setSelectedRun(refreshed);
            toastSuccess('已拒绝权限请求');
            void loadOpsData();
          }}
          onCancel={async () => {
            await agentService.cancelAgentRun(selectedRun.runId);
            setSelectedRun(null);
          }}
          onRetry={async () => {
            await agentService.retryAgentRun(selectedRun.runId);
            setSelectedRun(null);
          }}
          onArchive={async () => {
            await agentService.archiveAgentRun(selectedRun.runId);
            setSelectedRun(null);
            toastSuccess('已归档 Run');
          }}
          onReplay={async () => {
            const result = await agentService.replayAgentRun(selectedRun.runId);
            setReplayResult(result);
          }}
        />
      )}
      {replayResult && (
        <ReplayComparePanel result={replayResult} onClose={() => setReplayResult(null)} />
      )}
    </>
  );
};

export default OpsCenterPage;
