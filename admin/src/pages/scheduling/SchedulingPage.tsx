import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { devLogger } from '../../utils/devLogger';
import {
  getSchedules,
  saveSchedule,
  deleteSchedule,
  getTaskLogs,
  runTaskNow,
  type ScheduleTask,
  type TaskLog
} from '../../services/scheduleService';
import { getAdminStats, type FeedAdminStats } from '../../services/feedService';
import { getAdapters, getStats, getLogs } from '../../services/dashboardService';
import { getSettings } from '../../services/settingsService';
import { agentService, type Workflow } from '../../services/agentService';
import { useToast } from '../../context/ToastContext';
import { useMessageDialog } from '../../context/MessageDialogContext';
import SchedulingKpiBar, { type SystemStats } from './components/SchedulingKpiBar';
import SystemLogTerminal, { type SystemLog } from './components/SystemLogTerminal';
import ScheduleList from './components/ScheduleList';
import RunLogTable from './components/RunLogTable';
import ScheduleEditModal from './components/ScheduleEditModal';
import ScheduleDetailDrawer from './components/ScheduleDetailDrawer';
import { AnimatedPillTabs } from '../../components/UI/ScrollablePillNav';

type TabKey = 'tasks' | 'logs' | 'system';

/**
 * 「调度中心」单一入口：合并了原仪表盘 + 任务管理 + 时间线监控。
 * 顶部 KPI（融合 Dashboard + Scheduling 指标）→ Tab 切换：调度任务 / 运行日志 / 系统日志。
 */
const SchedulingPage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm: showConfirm } = useMessageDialog();

  const [schedules, setSchedules] = useState<ScheduleTask[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [adminStats, setAdminStats] = useState<FeedAdminStats | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

  const [adapters, setAdapters] = useState<string[]>([]);
  const [adapterGroups, setAdapterGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>('tasks');
  const [runningIds, setRunningIds] = useState<Record<string, boolean>>({});

  const [draft, setDraft] = useState<Partial<ScheduleTask> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);

  const detailSchedule = useMemo(
    () => schedules.find((s) => s.id === detailId) || null,
    [schedules, detailId]
  );

  const fetchSchedulesAndLogs = useCallback(async () => {
    try {
      const [schedulesData, logsData] = await Promise.all([
        getSchedules(),
        getTaskLogs({ limit: 100 })
      ]);
      setSchedules(schedulesData);
      setLogs(logsData);
    } catch (err) {
      devLogger.error('Failed to fetch schedules:', err);
      toastError('获取调度数据失败');
    }
  }, [toastError]);

  const fetchAdminStats = useCallback(async () => {
    try {
      const s = await getAdminStats();
      setAdminStats(s);
    } catch (err) {
      devLogger.warn('Failed to fetch admin stats:', err);
    }
  }, []);

  const fetchSystemSnapshot = useCallback(async () => {
    try {
      const [stats, sysLogs] = await Promise.all([getStats(), getLogs()]);
      setSysStats(stats as SystemStats);
      setSystemLogs((sysLogs as SystemLog[]) || []);
    } catch (err) {
      devLogger.warn('Failed to fetch system snapshot:', err);
    }
  }, []);

  const fetchResources = useCallback(async () => {
    try {
      const [a, wfs, settings] = await Promise.all([
        getAdapters(),
        agentService.getWorkflows(),
        getSettings()
      ]);
      setAdapters(Object.keys(a || {}));
      setAdapterGroups(
        (settings?.ADAPTERS || [])
          .filter((adapter: { enabled?: boolean }) => adapter.enabled !== false)
          .map((adapter: { id: string; name: string }) => ({ id: adapter.id, name: adapter.name }))
      );
      setWorkflows(wfs);
    } catch (err) {
      devLogger.warn('Failed to fetch resources:', err);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchSchedulesAndLogs();
    fetchAdminStats();
    fetchSystemSnapshot();
  }, [fetchSchedulesAndLogs, fetchAdminStats, fetchSystemSnapshot]);

  useEffect(() => {
    refreshAll();
    fetchResources();
    const timer = setInterval(refreshAll, 12_000);
    return () => clearInterval(timer);
  }, [refreshAll, fetchResources]);

  const handleSave = async (schedule: ScheduleTask) => {
    try {
      await saveSchedule(schedule);
      toastSuccess('保存成功');
      setEditorOpen(false);
      setDraft(null);
      fetchSchedulesAndLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      throw new Error(message);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm({
      title: '删除调度任务',
      message: '删除后该任务的历史记录仍会保留，但不再被调度器触发。是否继续？',
      confirmLabel: '删除',
      variant: 'danger',
      confirmTone: 'danger'
    });
    if (!ok) return;
    try {
      await deleteSchedule(id);
      toastSuccess('已删除调度任务');
      if (detailId === id) setDetailId(null);
      fetchSchedulesAndLogs();
    } catch {
      toastError('删除失败');
    }
  };

  const handleToggleEnable = async (schedule: ScheduleTask) => {
    try {
      const next = { ...schedule, enabled: !schedule.enabled };
      await saveSchedule(next);
      toastSuccess(next.enabled ? '已启用' : '已停用');
      fetchSchedulesAndLogs();
    } catch {
      toastError('操作失败');
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningIds((prev) => ({ ...prev, [id]: true }));
    try {
      await runTaskNow(id);
      toastSuccess('已手动触发');
      setTimeout(() => {
        fetchSchedulesAndLogs();
      }, 2000);
    } catch {
      toastError('触发失败');
    } finally {
      setTimeout(() => {
        setRunningIds((prev) => ({ ...prev, [id]: false }));
      }, 1500);
    }
  };

  const openCreate = () => {
    setDraft({
      id: `task_${Date.now()}`,
      name: '',
      cron: '30 9 * * *',
      timezone: 'Asia/Shanghai',
      type: 'WORKFLOW',
      targetId: '',
      enabled: true,
      inputs: { values: {} }
    });
    setEditorOpen(true);
  };

  const openEdit = (schedule: ScheduleTask) => {
    setDraft(schedule);
    setEditorOpen(true);
  };

  const tabCountText = useMemo(() => {
    if (activeTab === 'tasks') {
      return `共 ${schedules.length} 条调度任务，其中启用 ${schedules.filter((s) => s.enabled).length} 条`;
    }
    if (activeTab === 'logs') {
      return `共 ${logs.length} 条运行记录`;
    }
    return `共 ${systemLogs.length} 条系统日志，每分钟自动刷新`;
  }, [activeTab, schedules, logs, systemLogs]);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-text-ink dark:text-white text-[26px] sm:text-[32px] md:text-[40px] leading-[1.1] font-medium tracking-tight">
            调度中心
          </h2>
          <p className="text-text-slate dark:text-text-secondary text-[15px] mt-2 max-w-2xl">
            集中管理调度任务、运行状态与系统监控。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-medium border border-hairline-strong dark:border-white/10 text-text-charcoal dark:text-text-secondary hover:border-ink hover:text-ink dark:hover:border-white dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            刷新
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-ink hover:bg-charcoal dark:bg-white dark:hover:bg-slate-100 text-white dark:text-ink text-[13px] font-medium px-5 py-2.5 rounded-full transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            新建调度任务
          </button>
        </div>
      </div>

      <SchedulingKpiBar adminStats={adminStats} sysStats={sysStats} logs={logs} />

      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-hairline-soft bg-canvas dark:border-white/5 dark:bg-surface-dark sm:rounded-3xl lg:h-[520px]">
        <div className="flex shrink-0 flex-col gap-2 border-b border-hairline-soft px-3 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 min-w-0">
          <AnimatedPillTabs
            className="w-full min-w-0 sm:flex-1"
            trackClassName="border-0"
            size="sm"
            layoutId="scheduling-page-tabs"
            aria-label="调度中心分类"
            tabs={[
              { id: 'tasks', label: '调度任务' },
              { id: 'logs', label: '运行日志' },
              { id: 'system', label: '系统日志' }
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
          <p className="shrink-0 text-[11px] leading-snug text-text-stone sm:max-w-[min(42%,14rem)] sm:text-right">
            {tabCountText}
          </p>
        </div>

        <div className="flex-1 min-h-0">
          {activeTab === 'tasks' && (
            <div className="h-full overflow-y-auto">
              <ScheduleList
                schedules={schedules}
                logs={logs}
                workflows={workflows}
                runningIds={runningIds}
                onToggleEnable={handleToggleEnable}
                onRunNow={handleRunNow}
                onEdit={openEdit}
                onDelete={handleDelete}
                onOpenDetail={(s) => setDetailId(s.id)}
              />
            </div>
          )}
          {activeTab === 'logs' && (
            <div className="h-full">
              <RunLogTable
                logs={logs}
                taskNameFilterOptions={schedules.map((s) => ({ id: s.id, name: s.name }))}
              />
            </div>
          )}
          {activeTab === 'system' && (
            <div className="h-full">
              <SystemLogTerminal logs={systemLogs} />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editorOpen && (
          <ScheduleEditModal
            open={editorOpen}
            draft={draft}
            workflows={workflows}
            adapters={adapters}
            adapterGroups={adapterGroups}
            onClose={() => {
              setEditorOpen(false);
              setDraft(null);
            }}
            onSubmit={handleSave}
          />
        )}
      </AnimatePresence>

      <ScheduleDetailDrawer
        open={!!detailSchedule}
        schedule={detailSchedule}
        logs={logs}
        workflows={workflows}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (detailSchedule) openEdit(detailSchedule);
          setDetailId(null);
        }}
        onRunNow={() => detailSchedule && handleRunNow(detailSchedule.id)}
        running={detailSchedule ? !!runningIds[detailSchedule.id] : false}
      />
    </div>
  );
};

export default SchedulingPage;
