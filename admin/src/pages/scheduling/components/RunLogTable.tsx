import React, { useMemo, useState } from 'react';
import type { TaskLog } from '../../../services/scheduleService';
import { STATUS_LABEL } from '../utils/labels';

interface Props {
  logs: TaskLog[];
  taskNameFilterOptions?: Array<{ id: string; name: string }>;
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'success', label: '已成功' },
  { value: 'error', label: '已失败' },
  { value: 'running', label: '执行中' },
  { value: 'interrupted', label: '已中断' }
];

const RunLogTable: React.FC<Props> = ({ logs, taskNameFilterOptions }) => {
  const [taskId, setTaskId] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (taskId && log.taskId !== taskId) return false;
      if (status && log.status !== status) return false;
      return true;
    });
  }, [logs, taskId, status]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-hairline-soft dark:border-white/5 bg-surface-soft/40 dark:bg-canvas/[0.02] shrink-0">
        {taskNameFilterOptions && taskNameFilterOptions.length > 0 && (
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="p-1.5 text-xs bg-canvas dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-md"
          >
            <option value="">全部任务</option>
            {taskNameFilterOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        )}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="p-1.5 text-xs bg-canvas dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-md"
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-[10px] text-text-stone self-center">共 {filtered.length} 条</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-soft dark:bg-canvas/5 border-b border-hairline-soft dark:border-white/5 text-[10px] uppercase text-text-slate dark:text-text-stone font-semibold tracking-wider">
              <th className="px-5 py-2">任务</th>
              <th className="px-5 py-2 hidden sm:table-cell">开始时间</th>
              <th className="px-5 py-2">状态</th>
              <th className="px-5 py-2 hidden md:table-cell">进度</th>
              <th className="px-5 py-2 hidden md:table-cell">耗时</th>
              <th className="px-5 py-2 hidden lg:table-cell">处理量</th>
              <th className="px-5 py-2 hidden lg:table-cell">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-[360px]">
                  <div className="flex flex-col items-center justify-center h-full text-text-slate gap-2">
                    <span className="material-symbols-outlined text-4xl opacity-30">receipt_long</span>
                    <span className="text-sm">暂无运行记录</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-surface-soft dark:hover:bg-canvas/[0.01]">
                  <td className="px-5 py-2 font-medium text-text-charcoal dark:text-slate-200">{log.taskName}</td>
                  <td className="px-5 py-2 text-text-slate hidden sm:table-cell">{formatTime(log.startTime)}</td>
                  <td className="px-5 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full ${
                      log.status === 'success' ? 'bg-brand-teal/15 text-moss-dark' :
                      log.status === 'error' ? 'bg-rose-500/15 text-rose-500' :
                      log.status === 'running' ? 'bg-surface-yellow0/15 text-yellow-dark animate-pulse' :
                      'bg-surface-soft0/15 text-text-slate'
                    }`}>
                      {STATUS_LABEL[log.status] || log.status}
                    </span>
                  </td>
                  <td className="px-5 py-2 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-1 bg-surface dark:bg-canvas/5 rounded-full overflow-hidden">
                        <div className="h-full bg-ink transition-all" style={{ width: `${log.progress || 0}%` }} />
                      </div>
                      <span className="text-[10px] text-text-stone w-7 text-right">{log.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-2 text-text-slate hidden md:table-cell">{log.duration ? `${(log.duration / 1000).toFixed(1)}s` : '—'}</td>
                  <td className="px-5 py-2 text-text-slate hidden lg:table-cell">{log.resultCount ?? '—'}</td>
                  <td className="px-5 py-2 text-text-slate truncate max-w-xs hidden lg:table-cell" title={log.message || ''}>{log.message || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function formatTime(time?: string) {
  if (!time) return '—';
  return new Date(time).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default RunLogTable;
