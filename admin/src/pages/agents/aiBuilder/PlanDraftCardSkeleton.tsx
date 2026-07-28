import React from 'react';

interface PlanDraftCardSkeletonProps {
  statusText?: string;
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-hairline dark:bg-canvas/10 ${className}`} />;
}

export const PlanDraftCardSkeleton: React.FC<PlanDraftCardSkeletonProps> = ({ statusText }) => {
  return (
    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-canvas shadow-subtle dark:border-indigo-500/20 dark:bg-canvas/[0.04]">
      <div className="border-b border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-white/[0.03] dark:to-white/[0.02]">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 dark:text-indigo-300">计划草稿 · 生成中</p>
        </div>
        <SkeletonBar className="mb-2 h-5 w-2/3" />
        <SkeletonBar className="h-3 w-full max-w-xl" />
        <SkeletonBar className="mt-2 h-3 w-1/2 max-w-md" />
        {statusText && (
          <p className="mt-3 text-xs text-text-slate dark:text-text-stone">{statusText}</p>
        )}
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline-soft bg-surface-soft p-3 dark:border-white/10 dark:bg-black/20">
          <SkeletonBar className="mb-2 h-3 w-12" />
          <SkeletonBar className="h-4 w-8" />
        </div>
        <div className="rounded-2xl border border-hairline-soft bg-surface-soft p-3 dark:border-white/10 dark:bg-black/20">
          <SkeletonBar className="mb-2 h-3 w-12" />
          <SkeletonBar className="h-4 w-8" />
        </div>
        <div className="rounded-2xl border border-hairline-soft bg-surface-soft p-3 dark:border-white/10 dark:bg-black/20">
          <SkeletonBar className="mb-2 h-3 w-12" />
          <SkeletonBar className="h-4 w-8" />
        </div>
      </div>

      <div className="space-y-2 px-5 pb-5">
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-16 w-full" />
      </div>
    </section>
  );
};
