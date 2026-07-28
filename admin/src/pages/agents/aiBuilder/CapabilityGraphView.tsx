import React from 'react';
import type { CapabilityGraph, CapabilityGraphNode } from '../../../services/agentService';

interface CapabilityGraphViewProps {
  graph?: CapabilityGraph;
  compact?: boolean;
}

function actionLabel(action: CapabilityGraphNode['action']) {
  if (action === 'reuse') return '复用';
  if (action === 'create') return '新建';
  if (action === 'update') return '修改';
  if (action === 'produce') return '产出';
  return '引用';
}

function typeLabel(type: CapabilityGraphNode['type']) {
  if (type === 'agent') return '智能体';
  if (type === 'skill') return '技能';
  if (type === 'workflow') return '工作流';
  if (type === 'tool') return '工具';
  if (type === 'input') return '输入';
  if (type === 'output') return '输出';
  return 'MCP';
}

function tone(action: CapabilityGraphNode['action'], status: CapabilityGraphNode['status']) {
  if (status === 'blocked') return 'border-coral-light bg-coral-light text-red-800 dark:border-red-500/20 dark:bg-brand-coral/10 dark:text-red-100';
  if (action === 'create') return 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-100';
  if (action === 'update') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100';
  return 'border-hairline-soft bg-surface-soft text-text-charcoal dark:border-white/10 dark:bg-black/20 dark:text-text-secondary';
}

export const CapabilityGraphView: React.FC<CapabilityGraphViewProps> = ({ graph, compact }) => {
  if (!graph || graph.nodes.length === 0) return null;
  const nodes = compact ? graph.nodes.slice(0, 6) : graph.nodes;
  return (
    <section className="space-y-3 rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/10 dark:bg-canvas/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-stone">能力图</p>
          <p className="mt-1 text-sm font-semibold text-text-ink dark:text-white">
            复用 {graph.summary.reuse} · 新建 {graph.summary.create} · 修改 {graph.summary.update} · 风险 {graph.summary.risks}
          </p>
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-slate dark:bg-canvas/10 dark:text-text-stone">
          {graph.summary.reuse} 复用 · {graph.summary.create} 新建
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {nodes.map(node => (
          <div key={node.id} className={`rounded-2xl border p-3 ${tone(node.action, node.status)}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">{node.label}</p>
              <span className="shrink-0 rounded-full bg-canvas/70 px-2 py-0.5 text-[10px] font-semibold dark:bg-black/20">{actionLabel(node.action)}</span>
            </div>
            <p className="mt-1 text-[11px] opacity-80">{typeLabel(node.type)} · {node.status === 'blocked' ? '阻塞' : node.riskLevel || 'low'}</p>
            {node.summary && <p className="mt-2 line-clamp-2 text-xs leading-5 opacity-90">{node.summary}</p>}
          </div>
        ))}
      </div>
      {!compact && graph.edges.length > 0 && (
        <div className="space-y-1 border-t border-hairline-soft pt-3 dark:border-white/10">
          {graph.edges.slice(0, 8).map(edge => (
            <p key={edge.id} className="text-xs text-text-slate dark:text-text-stone">
              {edge.from} → {edge.to} · {edge.label}
            </p>
          ))}
        </div>
      )}
    </section>
  );
};
