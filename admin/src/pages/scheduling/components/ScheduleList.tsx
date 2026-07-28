import React from 'react';
import type { ScheduleTask, TaskLog } from '../../../services/scheduleService';
import type { Workflow } from '../../../services/agentService';
import { describeCron } from '../utils/cronDescribe';
import { STATUS_LABEL, TYPE_LABEL } from '../utils/labels';

interface Props {
  schedules: ScheduleTask[];
  logs: TaskLog[];
  workflows: Workflow[];
  runningIds: Record<string, boolean>;
  onToggleEnable: (schedule: ScheduleTask) => void;
  onRunNow: (id: string) => void;
  onEdit: (schedule: ScheduleTask) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (schedule: ScheduleTask) => void;
}

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

const MiniBars: React.FC<{ logs: TaskLog[] }> = ({ logs }) => {
  if (logs.length === 0) return <span className="text-[11px] text-text-stone">—</span>;
  return (
    <div className="flex h-5 items-end gap-0.5">
      {logs
        .slice()
        .reverse()
        .map((log) => {
          const color =
            log.status === 'success'
              ? 'bg-brand-teal'
              : log.status === 'error'
                ? 'bg-brand-coral'
                : log.status === 'running'
                  ? 'bg-brand-yellow-deep animate-pulse'
                  : 'bg-hairline-strong';
          const h = Math.max(4, Math.min(20, Math.round((log.duration || 1500) / 800)));
          const tooltip = `${STATUS_LABEL[log.status] || log.status} · ${log.duration ? `${(log.duration / 1000).toFixed(1)}s` : '运行中'}${log.message ? ` · ${log.message}` : ''}`;
          return (
            <div
              key={log.id}
              title={tooltip}
              style={{ height: `${h}px` }}
              className={`${color} w-1.5 rounded-full`}
            />
          );
        })}
    </div>
  );
};

const StatusBadge: React.FC<{ status?: ScheduleTask['lastStatus'] }> = ({ status }) => {
  if (!status) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-text-steel dark:bg-white/5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-stone" />
        从未执行
      </span>
    );
  }
  const map = {
    success: { label: '已成功', cls: 'text-moss-dark bg-teal-light', dot: 'bg-brand-teal' },
    error: { label: '已失败', cls: 'text-coral-dark bg-coral-light', dot: 'bg-brand-coral' },
    interrupted: {
      label: '已中断',
      cls: 'text-yellow-dark bg-surface-yellow',
      dot: 'bg-brand-yellow-deep'
    }
  } as const;
  const entry = (map as Record<string, (typeof map)[keyof typeof map]>)[status] || map.error;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${entry.cls}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${entry.dot}`} />
      {entry.label}
    </span>
  );
};

const EnableToggle: React.FC<{
  enabled: boolean;
  onToggle: () => void;
}> = ({ enabled, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={enabled ? '禁用任务' : '启用任务'}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
      enabled ? 'bg-ink dark:bg-white' : 'bg-hairline-strong dark:bg-slate-700'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
        enabled ? 'translate-x-[18px] bg-white dark:bg-ink' : 'translate-x-[3px] bg-white'
      }`}
    />
  </button>
);

const IconAction: React.FC<{
  icon: string;
  title: string;
  tone: string;
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
}> = ({ icon, title, tone, onClick, disabled, spinning }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-stone transition-colors disabled:opacity-40 ${tone}`}
    title={title}
  >
    <span className={`material-symbols-outlined text-[18px] ${spinning ? 'animate-spin' : ''}`}>
      {icon}
    </span>
  </button>
);

const ScheduleRowActions: React.FC<{
  scheduleId: string;
  running: boolean;
  onRunNow: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ scheduleId, running, onRunNow, onEdit, onDelete }) => (
  <div className="flex shrink-0 items-center justify-end gap-0.5">
    <IconAction
      icon={running ? 'progress_activity' : 'play_arrow'}
      title="立即执行一次"
      tone="hover:bg-teal-light hover:text-moss-dark dark:hover:bg-teal-light/20"
      spinning={running}
      disabled={running}
      onClick={() => onRunNow(scheduleId)}
    />
    <IconAction
      icon="edit"
      title="编辑配置"
      tone="hover:bg-surface-lavender hover:text-ink-deep dark:hover:bg-surface-lavender/20"
      onClick={onEdit}
    />
    <IconAction
      icon="delete"
      title="删除"
      tone="hover:bg-rose-light hover:text-coral-dark dark:hover:bg-rose-light/20"
      onClick={onDelete}
    />
  </div>
);

type ScheduleRowMeta = {
  schedule: ScheduleTask;
  typeLabel: string;
  targetText: string;
  recents: TaskLog[];
};

function useScheduleRows(
  schedules: ScheduleTask[],
  logs: TaskLog[],
  workflows: Workflow[]
): ScheduleRowMeta[] {
  const workflowName = (id: string) => workflows.find((w) => w.id === id)?.name || id;
  return schedules.map((schedule) => {
    const recents = logs.filter((l) => l.taskId === schedule.id).slice(0, 5);
    const typeLabel = TYPE_LABEL[schedule.type] || schedule.type;
    const targetText =
      schedule.type === 'WORKFLOW'
        ? workflowName(schedule.targetId)
        : schedule.targetId === 'all'
          ? '全部数据源'
          : schedule.targetId;
    return { schedule, typeLabel, targetText, recents };
  });
}

const ScheduleListMobile: React.FC<Props & { rows: ScheduleRowMeta[] }> = ({
  rows,
  runningIds,
  onToggleEnable,
  onRunNow,
  onEdit,
  onDelete,
  onOpenDetail
}) => {
  if (rows.length === 0) {
    return (
      <div className="flex h-[min(360px,50vh)] flex-col items-center justify-center gap-2 px-4 text-text-stone">
        <span className="material-symbols-outlined text-4xl opacity-30">event_repeat</span>
        <span className="text-[13px]">暂无调度任务</span>
        <span className="text-center text-[11px]">点击右上角「新建调度任务」开始</span>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-hairline-soft dark:divide-white/5 md:hidden">
      {rows.map(({ schedule, typeLabel, targetText }) => (
        <li key={schedule.id} className="px-3 py-3.5 sm:px-4">
          <button
            type="button"
            onClick={() => onOpenDetail(schedule)}
            className="mb-2.5 flex w-full min-w-0 flex-col text-left"
          >
            <span className="truncate font-medium text-text-ink dark:text-white">
              {schedule.name}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] text-text-stone dark:text-text-secondary">
              <span className="inline-flex shrink-0 items-center rounded-full bg-surface-lavender px-1.5 py-0.5 text-[10px] text-ink-deep">
                {typeLabel}
              </span>
              <span className="truncate">{targetText}</span>
            </span>
            <span className="mt-1.5 font-mono text-[11px] text-text-stone">{schedule.cron}</span>
            <span className="text-[10.5px] text-text-stone">{describeCron(schedule.cron)}</span>
          </button>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <StatusBadge status={schedule.lastStatus} />
              <div className="flex items-center gap-1.5 text-[11px] text-text-stone">
                <span>启用</span>
                <EnableToggle
                  enabled={schedule.enabled}
                  onToggle={() => onToggleEnable(schedule)}
                />
              </div>
            </div>
            <ScheduleRowActions
              scheduleId={schedule.id}
              running={!!runningIds[schedule.id]}
              onRunNow={onRunNow}
              onEdit={() => onEdit(schedule)}
              onDelete={() => onDelete(schedule.id)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

const ScheduleListTable: React.FC<Props & { rows: ScheduleRowMeta[] }> = ({
  rows,
  runningIds,
  onToggleEnable,
  onRunNow,
  onEdit,
  onDelete,
  onOpenDetail
}) => (
  <div className="hidden overflow-x-auto md:block">
    <table className="w-full min-w-[720px] border-collapse text-left">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-hairline-soft bg-surface-soft text-[11px] font-semibold uppercase tracking-[0.06em] text-text-steel dark:border-white/5 dark:bg-white/5 dark:text-text-secondary">
          <th className="px-5 py-3 font-semibold">调度任务</th>
          <th className="px-5 py-3 font-semibold">执行频率</th>
          <th className="hidden px-5 py-3 font-semibold lg:table-cell">最近 5 次</th>
          <th className="hidden px-5 py-3 font-semibold lg:table-cell">下次触发</th>
          <th className="hidden px-5 py-3 font-semibold sm:table-cell">上次执行</th>
          <th className="min-w-[6.5rem] px-5 py-3 font-semibold">状态</th>
          <th className="w-16 px-5 py-3 font-semibold">启用</th>
          <th className="w-[7.5rem] px-5 py-3 text-right font-semibold">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline-soft text-[13.5px] dark:divide-white/5">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8} className="h-[420px]">
              <div className="flex h-full flex-col items-center justify-center gap-2 text-text-stone">
                <span className="material-symbols-outlined text-4xl opacity-30">event_repeat</span>
                <span className="text-[13px]">暂无调度任务</span>
                <span className="text-[11px] text-text-stone">点击右上角「新建调度任务」开始</span>
              </div>
            </td>
          </tr>
        ) : (
          rows.map(({ schedule, typeLabel, targetText, recents }) => (
            <tr
              key={schedule.id}
              className="group transition-colors hover:bg-surface-soft dark:hover:bg-white/[0.02]"
            >
              <td className="px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => onOpenDetail(schedule)}
                  className="flex max-w-[260px] flex-col text-left"
                >
                  <span className="truncate font-medium text-text-ink dark:text-white">
                    {schedule.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-stone dark:text-text-secondary">
                    <span className="inline-flex items-center rounded-full bg-surface-lavender px-1.5 py-0.5 text-[10px] text-ink-deep">
                      {typeLabel}
                    </span>
                    <span className="truncate">{targetText}</span>
                  </span>
                </button>
              </td>
              <td className="px-5 py-3.5 text-[12px]">
                <span className="font-mono text-text-ink dark:text-white">{schedule.cron}</span>
                <div className="mt-0.5 text-[10.5px] text-text-stone dark:text-text-secondary">
                  {describeCron(schedule.cron)}
                </div>
              </td>
              <td className="hidden px-5 py-3.5 lg:table-cell">
                <MiniBars logs={recents} />
              </td>
              <td className="hidden px-5 py-3.5 text-[12px] text-text-slate dark:text-text-secondary lg:table-cell">
                {schedule.nextRun ? formatTime(schedule.nextRun) : '—'}
              </td>
              <td className="hidden px-5 py-3.5 text-[12px] text-text-slate dark:text-text-secondary sm:table-cell">
                {schedule.lastRun ? formatTime(schedule.lastRun) : '尚未执行'}
              </td>
              <td className="px-5 py-3.5">
                <StatusBadge status={schedule.lastStatus} />
              </td>
              <td className="px-5 py-3.5">
                <EnableToggle
                  enabled={schedule.enabled}
                  onToggle={() => onToggleEnable(schedule)}
                />
              </td>
              <td className="px-5 py-3.5">
                <ScheduleRowActions
                  scheduleId={schedule.id}
                  running={!!runningIds[schedule.id]}
                  onRunNow={onRunNow}
                  onEdit={() => onEdit(schedule)}
                  onDelete={() => onDelete(schedule.id)}
                />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const ScheduleList: React.FC<Props> = (props) => {
  const rows = useScheduleRows(props.schedules, props.logs, props.workflows);
  return (
    <>
      <ScheduleListMobile {...props} rows={rows} />
      <ScheduleListTable {...props} rows={rows} />
    </>
  );
};

export default ScheduleList;
