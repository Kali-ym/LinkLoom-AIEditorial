import React, { useState } from 'react';
import { jobStatusLabel, targetStorageLabel } from '../shared/ragStatusLabels.js';
import { SectionCard } from '../shared/ragUi.js';

type Props = {
  jobs: any[];
  jobsFilter: 'all' | 'failed';
  busy?: string | null;
  onLoadJobs: (filter: 'all' | 'failed') => void;
  onRetryDocument?: (documentId: string) => void;
  onRetryAllFailed?: () => void;
};

export const IngestJobQueue = React.forwardRef<HTMLDivElement, Props>(function IngestJobQueue(
  { jobs, jobsFilter, busy, onLoadJobs, onRetryDocument, onRetryAllFailed },
  ref
) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const failedJobs = jobs.filter((job) => job.status === 'failed');

  return (
    <div ref={ref}>
      <SectionCard title="任务队列" subtitle="最近 10 条索引任务">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'failed'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onLoadJobs(filter)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                jobsFilter === filter
                  ? 'bg-ink text-white dark:bg-white dark:text-ink'
                  : 'bg-surface-soft text-text-slate dark:bg-white/[0.04] dark:text-text-secondary'
              }`}
            >
              {filter === 'all' ? '全部' : '仅失败'}
            </button>
          ))}
          {jobsFilter === 'failed' && failedJobs.length > 0 && onRetryAllFailed && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onRetryAllFailed()}
              className="btn-pill-secondary !text-xs !py-1 !px-2.5 disabled:opacity-50"
            >
              {busy === 'reindex' ? '入队中…' : `重新入队全部（${failedJobs.length}）`}
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {jobs.length === 0 ? (
            <p className="rounded-2xl bg-surface-soft p-3 text-[13px] text-text-charcoal dark:bg-white/5 dark:text-text-secondary">
              暂无任务记录
            </p>
          ) : (
            jobs.map((job) => {
              const isFailed = job.status === 'failed';
              const isExpanded = expandedId === job.id;
              return (
                <div
                  key={job.id}
                  className={`rounded-2xl px-3 py-2 text-xs dark:bg-white/5 ${
                    isFailed ? 'bg-red-50 dark:bg-red-400/10' : 'bg-surface-soft'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => isFailed && setExpandedId(isExpanded ? null : job.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-text-ink dark:text-white">
                          {jobStatusLabel(job.status)}
                        </span>
                        <span className="text-[12px] text-text-charcoal dark:text-text-secondary">
                          {targetStorageLabel(job.targetStorage)} · 尝试 {job.attempts} 次
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[13px] text-text-charcoal dark:text-text-secondary">
                        文档：{job.documentId || '-'}
                      </p>
                    </button>
                    {isFailed && job.documentId && onRetryDocument && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => onRetryDocument(job.documentId)}
                        className="btn-pill-secondary shrink-0 !text-xs !py-1 !px-2 disabled:opacity-50"
                      >
                        重新入队
                      </button>
                    )}
                  </div>
                  {isFailed && job.lastError && isExpanded && (
                    <p className="mt-2 text-[13px] text-amber-700 dark:text-amber-200">{job.lastError}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </div>
  );
});
