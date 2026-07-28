import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScheduleTask, TaskLog } from '../../../services/scheduleService';
import type { Workflow } from '../../../services/agentService';
import { describeCron } from '../utils/cronDescribe';
import { STATUS_LABEL, TYPE_LABEL } from '../utils/labels';

interface Props {
  open: boolean;
  schedule: ScheduleTask | null;
  logs: TaskLog[];
  workflows: Workflow[];
  onClose: () => void;
  onEdit: () => void;
  onRunNow: () => void;
  running?: boolean;
}

const ScheduleDetailDrawer: React.FC<Props> = ({
  open,
  schedule,
  logs,
  workflows,
  onClose,
  onEdit,
  onRunNow,
  running
}) => {
  const taskLogs = useMemo(
    () => (schedule ? logs.filter((l) => l.taskId === schedule.id).slice(0, 20) : []),
    [logs, schedule]
  );
  const workflow = useMemo(
    () =>
      schedule && schedule.type === 'WORKFLOW'
        ? workflows.find((w) => w.id === schedule.targetId) || null
        : null,
    [workflows, schedule]
  );

  return (
    <AnimatePresence>
      {open && schedule && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-md bg-canvas dark:bg-surface-dark shadow-modal flex flex-col border-l border-hairline-soft dark:border-white/5"
          >
            <header className="px-5 py-4 border-b border-hairline-soft dark:border-white/5 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-text-ink dark:text-white">
                  {schedule.name}
                </h3>
                <p className="text-[11px] text-text-slate mt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-surface dark:bg-canvas/10 text-text-charcoal dark:text-text-stone mr-2">
                    {TYPE_LABEL[schedule.type] || schedule.type}
                  </span>
                  {schedule.description || '未填写描述'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-text-stone hover:text-text-charcoal dark:hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <section>
                <h4 className="text-[10px] uppercase font-semibold text-text-stone tracking-wider mb-2">
                  执行配置
                </h4>
                <div className="rounded-lg border border-hairline-soft dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  <Row
                    label="执行频率"
                    value={
                      <div>
                        <div className="font-mono text-ink-deep">{schedule.cron}</div>
                        <div className="text-[10px] text-text-stone">
                          {describeCron(schedule.cron)}
                        </div>
                      </div>
                    }
                  />
                  <Row label="时区" value={schedule.timezone || 'Asia/Shanghai'} />
                  <Row
                    label="执行对象"
                    value={
                      workflow
                        ? `${workflow.name} (${workflow.id})`
                        : schedule.targetId === 'all'
                          ? '全部数据源'
                          : schedule.targetId || '—'
                    }
                  />
                  <Row
                    label="下次触发"
                    value={schedule.nextRun ? formatTime(schedule.nextRun) : '—'}
                  />
                  <Row
                    label="上次执行"
                    value={schedule.lastRun ? formatTime(schedule.lastRun) : '尚未执行'}
                  />
                  <Row
                    label="状态"
                    value={
                      schedule.lastStatus
                        ? STATUS_LABEL[schedule.lastStatus] || schedule.lastStatus
                        : '从未执行'
                    }
                  />
                  {schedule.lastError && (
                    <Row
                      label="错误堆栈"
                      value={<span className="text-rose-500">{schedule.lastError}</span>}
                    />
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-[10px] uppercase font-semibold text-text-stone tracking-wider mb-2">
                  运行入参快照
                </h4>
                <pre className="bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg p-3 text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-60">
                  {JSON.stringify(schedule.inputs?.values ?? {}, null, 2)}
                </pre>
                {schedule.inputs?.bindings && Object.keys(schedule.inputs.bindings).length > 0 && (
                  <div className="mt-2 text-[11px] text-text-slate">
                    <div className="font-semibold text-text-charcoal dark:text-text-stone mb-1">
                      变量绑定：
                    </div>
                    <ul className="space-y-0.5">
                      {Object.entries(schedule.inputs.bindings).map(([key, binding]) => (
                        <li key={key} className="font-mono">
                          {key} →{' '}
                          <span className="text-ink-deep">
                            {binding.expression || JSON.stringify(binding.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section>
                <h4 className="text-[10px] uppercase font-semibold text-text-stone tracking-wider mb-2">
                  执行历史（最近 20 次）
                </h4>
                <div className="rounded-lg border border-hairline-soft dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  {taskLogs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-text-slate">暂无执行记录</div>
                  ) : (
                    taskLogs.map((log) => (
                      <div
                        key={log.id}
                        className="px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${
                              log.status === 'success'
                                ? 'bg-brand-teal'
                                : log.status === 'error'
                                  ? 'bg-rose-500'
                                  : log.status === 'running'
                                    ? 'bg-amber-400 animate-pulse'
                                    : 'bg-slate-400'
                            }`}
                          />
                          <span className="text-[11px] text-text-charcoal dark:text-slate-200">
                            {formatTime(log.startTime)}
                          </span>
                          <span
                            className="text-[10px] text-text-stone truncate"
                            title={log.message || ''}
                          >
                            {log.message || ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-slate">
                          {log.duration ? `${(log.duration / 1000).toFixed(1)}s` : '—'}
                          {typeof log.resultCount === 'number' && (
                            <span className="ml-1">/ {log.resultCount}</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <footer className="p-4 border-t border-hairline-soft dark:border-white/5 flex gap-2">
              <button
                onClick={onRunNow}
                disabled={running}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-ink hover:bg-ink/90 text-white disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-base">
                  {running ? 'progress_activity' : 'play_arrow'}
                </span>
                立即执行一次
              </button>
              <button
                onClick={onEdit}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-hairline-soft dark:border-white/10 text-text-charcoal dark:text-text-stone hover:text-ink-deep hover:border-ink"
              >
                编辑配置
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="px-3 py-2 flex items-start justify-between gap-3">
    <span className="text-[11px] uppercase text-text-slate">{label}</span>
    <span className="text-xs text-text-charcoal dark:text-slate-200 text-right max-w-[70%]">
      {value}
    </span>
  </div>
);

function formatTime(time?: string) {
  if (!time) return '—';
  return new Date(time).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default ScheduleDetailDrawer;
