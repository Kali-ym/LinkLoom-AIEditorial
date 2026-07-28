import React from 'react';
import { aiBuilderUi } from '../../../copy/aiBuilderUi';
import type { BuilderStateGraph } from '../../../services/agentService';

interface BuilderStateStepsProps {
  graph?: BuilderStateGraph;
  className?: string;
  compact?: boolean;
}

const FALLBACK_STEPS = [
  {
    id: 'chat',
    label: '对话',
    description: '自由讨论目标、引用资源、探索能力边界',
    status: 'active'
  },
  { id: 'plan', label: '计划', description: '澄清问题、沉淀方案草稿、确认风险', status: 'pending' },
  { id: 'build', label: '构建评审', description: '从草稿生成可审阅的构建计划', status: 'pending' },
  {
    id: 'dryRun',
    label: aiBuilderUi.stepLabel,
    description: aiBuilderUi.stepDescription,
    status: 'pending'
  },
  { id: 'apply', label: '写库', description: '用户确认后应用资源变更', status: 'pending' },
  {
    id: 'result',
    label: '结果',
    description: '查看交付摘要、失败原因和可回退节点',
    status: 'pending'
  }
] as const;

export const BuilderStateSteps: React.FC<BuilderStateStepsProps> = ({
  graph,
  className = '',
  compact = false
}) => {
  const nodes = graph?.nodes?.length ? graph.nodes : FALLBACK_STEPS;
  const currentId = graph?.current;

  if (compact) {
    const currentIndex = Math.max(
      0,
      nodes.findIndex((node) => node.id === currentId)
    );
    const currentNode = nodes[currentIndex] || nodes[0];

    return (
      <nav
        aria-label="构建流程"
        className={`inline-flex max-w-[min(52vw,12rem)] items-center gap-1.5 rounded-full border border-hairline-soft bg-surface-soft px-2 py-1 dark:border-white/10 dark:bg-canvas/[0.04] ${className}`.trim()}
      >
        <span className="truncate text-[9px] font-semibold text-text-charcoal dark:text-text-secondary">
          {currentNode?.label}
        </span>
        <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          {nodes.map((node, index) => (
            <span
              key={node.id}
              className={`h-1 w-1 rounded-full ${
                index < currentIndex
                  ? 'bg-brand-teal'
                  : index === currentIndex
                    ? 'bg-ink dark:bg-canvas'
                    : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
          ))}
        </span>
      </nav>
    );
  }

  return (
    <nav
      aria-label="构建流程"
      className={`inline-flex max-w-[min(46vw,22rem)] items-center overflow-x-auto rounded-full border border-hairline-soft bg-surface-soft p-0.5 dark:border-white/10 dark:bg-canvas/[0.04] ${className}`.trim()}
    >
      {nodes.map((node) => {
        const isCurrent = node.id === currentId;
        const isCompleted = node.status === 'completed';
        const isBlocked = node.status === 'blocked';

        return (
          <span
            key={node.id}
            title={'description' in node ? node.description : undefined}
            className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none transition-colors ${
              isCurrent
                ? 'bg-canvas text-text-ink shadow-subtle ring-1 ring-slate-200/80 dark:bg-canvas/12 dark:text-white dark:ring-white/10'
                : isCompleted
                  ? 'text-moss-dark dark:text-moss-dark'
                  : isBlocked
                    ? 'text-coral-dark dark:text-red-400'
                    : 'text-text-stone dark:text-text-slate'
            }`}
          >
            {node.label}
          </span>
        );
      })}
    </nav>
  );
};
