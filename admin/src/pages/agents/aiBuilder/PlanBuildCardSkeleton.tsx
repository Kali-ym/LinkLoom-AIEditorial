import React from 'react';
import { aiBuilderUi } from '../../../copy/aiBuilderUi';

interface PlanBuildCardSkeletonProps {
  statusText?: string;
  phase?: 'generating' | 'dry_run';
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-hairline dark:bg-canvas/10 ${className}`} />;
}

export const PlanBuildCardSkeleton: React.FC<PlanBuildCardSkeletonProps> = ({
  statusText,
  phase = 'generating'
}) => {
  const phaseLabel = phase === 'dry_run' ? aiBuilderUi.skeletonPhase : '构建评审单 · 生成中';

  return (
    <section className="overflow-hidden rounded-3xl border border-hairline-soft bg-canvas shadow-subtle dark:border-white/10 dark:bg-canvas/[0.04]">
      <div className="border-b border-hairline-soft bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 dark:border-white/10 dark:from-white/[0.04] dark:via-white/[0.02] dark:to-white/[0.03]">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          <p className="text-xs font-semibold uppercase tracking-widest text-text-stone">
            {phaseLabel}
          </p>
        </div>
        <SkeletonBar className="mb-2 h-5 w-3/4" />
        <SkeletonBar className="h-3 w-full max-w-xl" />
        <SkeletonBar className="mt-2 h-3 w-2/3 max-w-lg" />
        {statusText && (
          <p className="mt-3 text-xs text-text-slate dark:text-text-stone">{statusText}</p>
        )}
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-hairline-soft bg-surface-soft p-3 dark:border-white/10 dark:bg-black/20">
          <SkeletonBar className="mb-2 h-3 w-20" />
          <SkeletonBar className="h-4 w-24" />
        </div>
        <div className="rounded-2xl border border-hairline-soft bg-surface-soft p-3 dark:border-white/10 dark:bg-black/20">
          <SkeletonBar className="mb-2 h-3 w-16" />
          <SkeletonBar className="h-4 w-28" />
        </div>
      </div>

      <div className="space-y-2 px-5 pb-5">
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-24 w-full" />
      </div>
    </section>
  );
};
