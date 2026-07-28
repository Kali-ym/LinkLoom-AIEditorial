import React, { useEffect, useRef } from 'react';

export interface SystemLog {
  timestamp: string;
  level: string;
  message: string;
}

interface Props {
  logs: SystemLog[];
}

const levelLabel: Record<string, string> = {
  ERROR: '错误',
  WARN: '警告',
  INFO: '信息'
};

const levelColor: Record<string, string> = {
  ERROR: 'text-accent-error',
  WARN: 'text-accent-warning',
  INFO: 'text-accent-success'
};

const SystemLogTerminal: React.FC<Props> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="material-symbols-outlined text-text-slate text-sm">terminal</span>
        <h4 className="text-text-slate dark:text-text-stone text-sm font-medium">系统日志</h4>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 w-full bg-ink dark:bg-surface-darker border border-slate-700 dark:border-white/5 rounded-lg p-4 font-mono text-xs text-text-stone dark:text-text-stone overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700"
      >
        {logs.length === 0 ? (
          <p className="text-text-charcoal">等待日志输入...</p>
        ) : (
          logs.map((log, i) => (
            <p key={`${log.timestamp}-${i}`} className="mb-1 break-words">
              <span className="text-ink-deep">[{log.timestamp}]</span>{' '}
              <span className={levelColor[log.level] || 'text-accent-success'}>
                {levelLabel[log.level] || log.level}
              </span>
              : {log.message}
            </p>
          ))
        )}
      </div>
    </div>
  );
};

export default SystemLogTerminal;
