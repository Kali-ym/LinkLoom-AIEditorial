import React from 'react';
import type { PlanDraft } from '../../../services/agentService';
import { CapabilityGraphView } from './CapabilityGraphView';
import { PlanContractPanel } from './PlanContractPanel';

interface PlanDraftCardProps {
  draft: PlanDraft;
  collapsed?: boolean;
  superseded?: boolean;
  generateBlockedReason?: string;
  onToggleCollapse?: () => void;
  onEnterBuild?: () => void;
}

function targetLabel(target: PlanDraft['target']) {
  if (target === 'agent') return '智能体';
  if (target === 'skill') return '技能';
  return '工作流';
}

function resourceTypeLabel(type: PlanDraft['proposedResources'][number]['type']) {
  if (type === 'agent') return '智能体';
  if (type === 'skill') return '技能';
  if (type === 'workflow') return '工作流';
  if (type === 'tool') return '工具';
  return 'MCP';
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-stone dark:text-text-slate">
      {children}
    </p>
  );
}

export const PlanDraftCard: React.FC<PlanDraftCardProps> = ({
  draft,
  collapsed,
  superseded,
  generateBlockedReason,
  onToggleCollapse,
  onEnterBuild
}) => {
  const versionLabel = `v${draft.version || 1}`;
  const canEnterBuild = !superseded && !generateBlockedReason;
  const createCount = draft.proposedResources.filter(item => item.action === 'create').length;
  const updateCount = draft.proposedResources.filter(item => item.action === 'update').length;
  const reuseCount = draft.proposedResources.filter(item => item.action === 'reuse').length;
  const skillCount = draft.proposedResources.filter(item => item.type === 'skill').length;

  if (collapsed) {
    return (
      <section className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-subtle ${
        superseded ? 'border-hairline-soft bg-surface-soft opacity-70 dark:border-white/10 dark:bg-canvas/[0.03]' : 'border-indigo-100 bg-canvas dark:border-indigo-500/20 dark:bg-canvas/[0.04]'
      }`}>
        <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-300">route</span>
        <button type="button" onClick={onToggleCollapse} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-semibold text-slate-950 dark:text-white">
            计划草稿 {versionLabel} · {generateBlockedReason || draft.status === 'needs_input' ? '待确认' : '可生成构建计划'}
          </span>
          <span className="block truncate text-xs text-text-slate dark:text-text-stone">{draft.summary}</span>
        </button>
        {!superseded && onEnterBuild && (
          <button
            type="button"
            onClick={onEnterBuild}
            disabled={!canEnterBuild}
            title={generateBlockedReason}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">construction</span>
            生成构建计划
          </button>
        )}
        <button type="button" onClick={onToggleCollapse} className="rounded-lg px-2 py-1 text-xs font-semibold text-text-slate hover:bg-surface dark:hover:bg-canvas/10">
          展开
        </button>
      </section>
    );
  }

  return (
    <section className={`overflow-hidden rounded-3xl border bg-canvas shadow-subtle dark:bg-canvas/[0.04] ${
      superseded ? 'border-hairline-soft opacity-70 dark:border-white/10' : 'border-indigo-100 dark:border-indigo-500/20'
    }`}>
      <div className="border-b border-indigo-100/80 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 dark:border-indigo-500/15 dark:from-indigo-500/10 dark:via-white/[0.03] dark:to-white/[0.02]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">计划草稿 {versionLabel}</span>
              <span className="rounded-full border border-hairline-soft bg-canvas px-2.5 py-1 text-[11px] font-semibold text-text-charcoal dark:border-white/10 dark:bg-canvas/[0.06] dark:text-text-secondary">
                {targetLabel(draft.target)} · {draft.mode === 'update' ? '修改' : '创建'}
              </span>
              {superseded && <span className="rounded-full bg-hairline px-2.5 py-1 text-[11px] font-semibold text-text-charcoal">已被取代</span>}
            </div>
            <h4 className="text-lg font-semibold text-slate-950 dark:text-white">{draft.title || draft.summary}</h4>
            <p className="mt-2 text-sm leading-6 text-text-charcoal dark:text-text-stone">{draft.summary}</p>
          </div>
          <button type="button" onClick={onToggleCollapse} className="shrink-0 rounded-2xl border border-hairline-soft bg-canvas px-3 py-2 text-xs font-semibold text-text-charcoal hover:bg-surface-soft dark:border-white/10 dark:bg-canvas/[0.04] dark:text-text-secondary dark:hover:bg-canvas/10">
            收起
          </button>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: '复用', value: reuseCount, tone: 'text-indigo-700 dark:text-indigo-200' },
            { label: '新建', value: createCount, tone: 'text-moss-dark dark:text-emerald-200' },
            { label: '修改', value: updateCount, tone: 'text-amber-700 dark:text-amber-200' }
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-hairline-soft bg-surface-soft p-4 dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-stone">{item.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
              <p className="mt-1 text-xs text-text-slate dark:text-text-stone">项资源</p>
            </div>
          ))}
        </div>

        {draft.decisions.length > 0 && (
          <div>
            <SectionTitle>关键决策</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.decisions.slice(0, 6).map(decision => (
                <div key={decision.id} className="min-h-[88px] rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/10 dark:bg-canvas/[0.03]">
                  <p className="font-semibold text-text-ink dark:text-white">{decision.label}</p>
                  <p className="mt-2 text-xs leading-5 text-text-slate dark:text-text-stone">{decision.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {draft.proposedResources.length > 0 && (
          <div>
            <SectionTitle>资源建议</SectionTitle>
            {skillCount > 0 && (
              <p className="mb-3 text-xs text-text-slate dark:text-text-stone">
                含 {skillCount} 个技能项，可在构建阶段绑定到智能体。
              </p>
            )}
            <div className="space-y-3">
              {draft.proposedResources.slice(0, 8).map((resource, index) => (
                <div key={`${resource.name}_${index}`} className="flex items-start gap-3 rounded-2xl border border-hairline-soft bg-surface-soft p-4 dark:border-white/10 dark:bg-black/20">
                  <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-text-charcoal dark:bg-canvas/[0.08] dark:text-text-secondary">
                    {resource.action === 'reuse' ? '复用' : resource.action === 'create' ? '新建' : '修改'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
                      {resourceTypeLabel(resource.type)}
                    </p>
                    <p className="font-semibold text-text-ink dark:text-white">{resource.name}</p>
                    <p className="mt-1 text-xs leading-5 text-text-slate dark:text-text-stone">{resource.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {draft.risks.length > 0 && (
          <div>
            <SectionTitle>待确认风险</SectionTitle>
            <div className="space-y-2">
              {draft.risks.map((risk, index) => (
                <p key={`${risk}_${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  {risk}
                </p>
              ))}
            </div>
          </div>
        )}

        {(draft.capabilityGraph || draft.contract) && (
          <details className="overflow-hidden rounded-2xl border border-hairline-soft dark:border-white/10">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-text-slate dark:text-text-stone">
              架构详情（能力图 / 契约）
            </summary>
            <div className="grid gap-3 border-t border-hairline-soft p-4 lg:grid-cols-2 dark:border-white/10">
              <CapabilityGraphView graph={draft.capabilityGraph} compact />
              <PlanContractPanel contract={draft.contract} compact />
            </div>
          </details>
        )}

        {!superseded && (
          <div className="flex flex-col gap-2 border-t border-hairline-soft pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end dark:border-white/10">
            {generateBlockedReason && (
              <p className="mr-auto text-xs text-amber-700 dark:text-amber-200">{generateBlockedReason}</p>
            )}
            {onEnterBuild && (
              <button
                type="button"
                onClick={onEnterBuild}
                disabled={!canEnterBuild}
                title={generateBlockedReason}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">construction</span>
                生成构建计划
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
