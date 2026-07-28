import React, { useEffect, useMemo, useState } from 'react';
import { aiBuilderUi } from '../../../copy/aiBuilderUi';
import type {
  Agent,
  AiBuildApplyResult,
  AiBuildChange,
  AiBuildPlan,
  PlanQuestion,
  WorkflowPlanStep
} from '../../../services/agentService';
import { formatJson } from '../../../utils/jsonField';
import { useStepCatalog } from '../../../hooks/useStepCatalog';
import { SchemaForm } from '../workflow/shared/SchemaForm';
import { CapabilityGraphView } from './CapabilityGraphView';
import { BuildErrorPanel, BuildProgressBar, IndeterminateProgressBar } from './BuildProgressBar';
import { PlanContractPanel } from './PlanContractPanel';
import { PlanQuestionForm } from './PlanQuestionForm';

const PIPELINE_KINDS = new Set<WorkflowPlanStep['kind']>([
  'adapter',
  'store-query',
  'store-write',
  'kv-write',
  'transform',
  'batch-iterate'
]);

const STEP_KIND_LABELS: Record<WorkflowPlanStep['kind'], string> = {
  agent: '智能体',
  workflow: '子工作流',
  tool: '流程动作',
  adapter: '数据源采集',
  'store-query': '库内查询',
  'store-write': '写回条目',
  'kv-write': '键值存储',
  transform: '数据转换',
  'batch-iterate': '批量循环'
};

const STEP_KIND_COLORS: Record<WorkflowPlanStep['kind'], string> = {
  agent: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
  workflow: 'bg-teal-light text-moss-dark dark:bg-brand-teal/15 dark:text-emerald-200',
  tool: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  adapter: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
  'store-query': 'bg-teal-light text-moss-dark dark:bg-brand-teal/15 dark:text-emerald-200',
  'store-write': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  'kv-write': 'bg-surface-lavender text-ink-deep dark:bg-purple-500/15 dark:text-violet-200',
  transform: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
  'batch-iterate': 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
};

function summarizeStepConfig(step: WorkflowPlanStep): string | undefined {
  const source = step.configOverrides ?? step.config;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const entries = Object.entries(source as Record<string, unknown>).slice(0, 3);
  if (entries.length === 0) return undefined;
  return entries
    .map(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const text = String(value);
        return `${key}=${text.length > 24 ? `${text.slice(0, 24)}…` : text}`;
      }
      if (Array.isArray(value)) return `${key}=[${value.length} items]`;
      if (value && typeof value === 'object') return `${key}={…}`;
      return `${key}=…`;
    })
    .join(' · ');
}

/**
 * 用 SchemaForm 渲染单个 pipeline 步骤的 config 编辑。
 * 折叠默认收起；保存时把"与 defaults 不同"的字段作为 configOverrides 写回 plan。
 */
const PipelineStepConfigEditor: React.FC<{
  step: WorkflowPlanStep;
  onSave: (next: {
    config?: Record<string, unknown>;
    configOverrides?: Record<string, unknown>;
  }) => void;
}> = ({ step, onSave }) => {
  const { getDef, loading, error } = useStepCatalog();
  const def = getDef(step.kind);
  const defaults = (def?.defaultConfig || {}) as Record<string, unknown>;
  const baselineMerged = useMemo(
    () => ({ ...defaults, ...(step.config || {}) }),
    [defaults, step.config]
  );
  const initialMerged = useMemo(
    () => ({ ...baselineMerged, ...(step.configOverrides || {}) }),
    [baselineMerged, step.configOverrides]
  );
  const [draft, setDraft] = useState<Record<string, unknown>>(initialMerged);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(initialMerged);
    setDirty(false);
  }, [initialMerged]);

  if (!def || def.category !== 'pipeline' || !def.configSchema) return null;

  const handleSave = () => {
    const overrides: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(draft)) {
      if (JSON.stringify(baselineMerged[key]) !== JSON.stringify(value)) {
        overrides[key] = value;
      }
    }
    onSave({
      config: step.config,
      configOverrides: Object.keys(overrides).length > 0 ? overrides : undefined
    });
    setDirty(false);
  };

  const handleReset = () => {
    setDraft(initialMerged);
    setDirty(false);
  };

  return (
    <details className="mt-3 overflow-hidden rounded-2xl border border-hairline-soft bg-canvas dark:border-white/10 dark:bg-canvas/[0.03]">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-text-slate dark:text-text-stone">
        调整 config（{def.label}）
      </summary>
      <div className="space-y-3 border-t border-hairline-soft p-3 dark:border-white/10">
        {loading && <p className="text-[11px] text-text-slate">加载步骤目录中...</p>}
        {error && <p className="text-[11px] text-coral-dark dark:text-red-300">{error}</p>}
        <SchemaForm
          spec={def.configSchema}
          values={draft}
          onChange={(next) => {
            setDraft(next);
            setDirty(true);
          }}
          hideGroupTitles
        />
        <div className="flex items-center justify-end gap-2">
          {dirty && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-hairline-soft px-2.5 py-1 text-[11px] font-semibold text-text-charcoal hover:bg-surface-soft dark:border-white/10 dark:text-text-stone dark:hover:bg-canvas/5"
            >
              撤销
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            className="rounded-lg bg-ink px-3 py-1 text-[11px] font-semibold text-white hover:bg-charcoal disabled:opacity-50 dark:bg-canvas dark:text-text-ink"
          >
            保存覆盖
          </button>
        </div>
      </div>
    </details>
  );
};

interface PlanBuildCardProps {
  plan: AiBuildPlan;
  collapsed?: boolean;
  superseded?: boolean;
  dryRunLoading?: boolean;
  dryRunFailed?: boolean;
  applyStep?: number;
  applyTotal?: number;
  buildLog?: string[];
  buildResult?: AiBuildApplyResult;
  buildError?: string;
  applyBlockedReason?: string;
  onToggleCollapse?: () => void;
  onStartBuild?: () => void;
  onRetryDryRun?: () => void;
  onAnswersSubmit?: (answers: Record<string, unknown>) => void;
  onPlanEdited?: (plan: AiBuildPlan) => void;
}

function actionLabel(change: AiBuildChange) {
  const labels: Record<string, string> = {
    createAgent: '创建智能体',
    updateAgent: '修改智能体',
    createWorkflow: '创建工作流',
    updateWorkflow: '修改工作流',
    createSkillFile: '创建技能文件',
    updateSkillFile: '修改技能文件'
  };
  return labels[change.action] || change.action;
}

function changeTitle(change: AiBuildChange) {
  if (change.action === 'createAgent' || change.action === 'updateAgent')
    return change.agent.name || change.agent.id;
  if (change.action === 'createWorkflow' || change.action === 'updateWorkflow')
    return change.workflow.name || change.workflow.id;
  return `${change.skillId}/${change.filePath}`;
}

function planStats(plan: AiBuildPlan) {
  return {
    agents: plan.resourceChanges.filter((change) => change.action.includes('Agent')).length,
    skills: plan.resourceChanges.filter((change) => change.action.includes('Skill')).length,
    workflows: plan.resourceChanges.filter((change) => change.action.includes('Workflow')).length
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function agentChanges(plan: AiBuildPlan) {
  return plan.resourceChanges.flatMap((change) =>
    change.action === 'createAgent' || change.action === 'updateAgent'
      ? [{ action: actionLabel(change), agent: change.agent }]
      : []
  );
}

function compactIds(ids?: string[]) {
  if (!ids?.length) return '无';
  if (ids.length <= 3) return ids.join('、');
  return `${ids.slice(0, 3).join('、')} +${ids.length - 3}`;
}

function agentRuntimeSummary(agent: Agent) {
  const runtime = agent.runtime;
  if (!runtime) return '未声明 runtime';
  const rounds = runtime.maxRounds ? `${runtime.maxRounds} rounds` : '默认 rounds';
  const trace = runtime.returnTrace ? 'trace on' : 'trace off';
  const errorStrategy = runtime.toolErrorStrategy || 'observe-and-continue';
  return `${runtime.mode || 'classic'} · ${rounds} · ${trace} · ${errorStrategy}`;
}

function agentContractState(agent: Agent) {
  const metadata = isRecord(agent.metadata) ? agent.metadata : undefined;
  const aiBuilder = isRecord(metadata?.aiBuilder) ? metadata.aiBuilder : undefined;
  const contract = isRecord(aiBuilder?.contract) ? aiBuilder.contract : undefined;
  if (!contract) return '未声明输入输出契约';
  const hasInput = contract.inputSchema !== undefined;
  const hasOutput = contract.outputSchema !== undefined;
  if (hasInput && hasOutput) return '已声明输入 / 输出契约';
  if (hasInput) return '已声明输入契约';
  if (hasOutput) return '已声明输出契约';
  return '已声明契约说明';
}

function statusLabel(plan: AiBuildPlan, superseded?: boolean) {
  if (superseded) return '已被取代';
  if (plan.status === 'pending_validation') return aiBuilderUi.pendingValidation;
  if (plan.status === 'building') return '构建中';
  if (plan.status === 'applied') return '已完成';
  if (plan.status === 'failed') return '构建失败';
  if (plan.validation.status === 'ok') return '可构建';
  if (plan.validation.status === 'needs_input') return '待补充';
  return '有错误';
}

function riskLabel(plan: AiBuildPlan) {
  const dryRunHighRisk =
    plan.dryRun?.riskPolicy?.hasHighRisk ||
    plan.dryRun?.changes.some((change) => change.riskLevel === 'high');
  if (plan.validation.status === 'invalid' || dryRunHighRisk) return '高风险';
  if ((plan.warnings?.length || 0) > 0 || (plan.dryRun?.warnings.length || 0) > 0) return '需留意';
  return '低风险';
}

function targetLabel(target: AiBuildPlan['target']) {
  if (target === 'agent') return '智能体';
  if (target === 'skill') return '技能';
  return '工作流';
}

function modeLabel(mode: AiBuildPlan['mode']) {
  return mode === 'update' ? '修改模式' : '创建模式';
}

function applyActionLabel(plan: AiBuildPlan, isBuilding: boolean) {
  if (isBuilding) return '写库中...';
  return plan.dryRun?.riskPolicy?.hasHighRisk ? '高风险二次确认并写库' : '确认写库';
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-stone dark:text-text-slate">
      {children}
    </p>
  );
}

export const PlanBuildCard: React.FC<PlanBuildCardProps> = ({
  plan,
  collapsed = true,
  superseded,
  dryRunLoading = false,
  dryRunFailed = false,
  applyStep,
  applyTotal,
  buildLog = [],
  buildResult,
  buildError,
  applyBlockedReason,
  onToggleCollapse,
  onStartBuild,
  onRetryDryRun,
  onAnswersSubmit,
  onPlanEdited
}) => {
  const stats = planStats(plan);
  const agentCapabilityChanges = agentChanges(plan);
  const versionLabel = `v${plan.version || 1}`;
  const canBuild =
    !superseded &&
    plan.validation.status === 'ok' &&
    plan.status !== 'building' &&
    plan.status !== 'applied' &&
    !applyBlockedReason;
  const isBuilding = plan.status === 'building';
  const [summaryDraft, setSummaryDraft] = useState(plan.summary);
  const [workflowPlanDraft, setWorkflowPlanDraft] = useState(formatJson(plan.workflowPlan || {}));
  const [resourceChangesDraft, setResourceChangesDraft] = useState(
    formatJson(plan.resourceChanges || [])
  );
  const [editError, setEditError] = useState('');
  const [dryRunOpen, setDryRunOpen] = useState(false);

  useEffect(() => {
    setSummaryDraft(plan.summary);
    setWorkflowPlanDraft(formatJson(plan.workflowPlan || {}));
    setResourceChangesDraft(formatJson(plan.resourceChanges || []));
    setEditError('');
  }, [plan.id, plan.version, plan.summary, plan.workflowPlan, plan.resourceChanges]);

  useEffect(() => {
    if ((plan.dryRun?.errors.length || 0) > 0) setDryRunOpen(true);
  }, [plan.dryRun]);

  const saveStructuredEdit = () => {
    if (!onPlanEdited) return;
    try {
      const workflowPlan =
        workflowPlanDraft.trim() && workflowPlanDraft.trim() !== '{}'
          ? JSON.parse(workflowPlanDraft)
          : undefined;
      const resourceChanges = JSON.parse(resourceChangesDraft);
      if (!Array.isArray(resourceChanges)) throw new Error('resourceChanges 必须是数组');
      onPlanEdited({
        ...plan,
        summary: summaryDraft.trim() || plan.summary,
        workflowPlan,
        resourceChanges,
        status: 'pending_validation',
        dryRun: undefined,
        validation: { ...plan.validation, status: 'ok', errors: [] }
      });
    } catch (error: any) {
      setEditError(error.message || '计划编辑内容不是合法 JSON');
    }
  };

  if (collapsed) {
    return (
      <div
        className={`flex max-w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-subtle ${
          superseded
            ? 'border-hairline-soft bg-surface-soft opacity-75 dark:border-white/10 dark:bg-canvas/[0.03]'
            : 'border-hairline-soft bg-canvas dark:border-white/10 dark:bg-canvas/[0.05]'
        }`}
      >
        <span className="material-symbols-outlined text-[18px] text-text-slate">checklist</span>
        <button type="button" onClick={onToggleCollapse} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-semibold text-text-ink dark:text-white">
            构建评审单 {versionLabel} · {statusLabel(plan, superseded)} · {riskLabel(plan)}
          </span>
          <span className="block truncate text-xs text-text-slate dark:text-text-stone">
            {isBuilding
              ? applyTotal
                ? `写库中 · ${applyStep ?? 0}/${applyTotal}`
                : '写库中...'
              : `将变更 ${stats.agents} 个智能体、${stats.skills} 个技能文件、${stats.workflows} 个工作流`}
          </span>
        </button>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-text-slate hover:bg-surface dark:hover:bg-canvas/10"
          >
            展开
          </button>
        )}
        {onStartBuild && plan.status !== 'applied' && (
          <button
            type="button"
            onClick={onStartBuild}
            disabled={!canBuild || isBuilding}
            title={applyBlockedReason}
            className="rounded-2xl bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-charcoal disabled:opacity-50"
          >
            {applyActionLabel(plan, isBuilding)}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-hairline-soft bg-canvas shadow-subtle dark:border-white/10 dark:bg-canvas/[0.04]">
      <div className="border-b border-hairline-soft bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-5 dark:border-white/10 dark:from-white/[0.04] dark:via-white/[0.02] dark:to-emerald-500/10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${plan.validation.status === 'ok' ? 'bg-brand-teal' : plan.validation.status === 'needs_input' ? 'bg-ink' : 'bg-brand-coral'}`}
              />
              <span className="text-xs font-semibold uppercase tracking-widest text-text-stone">
                构建评审单 {versionLabel} · {statusLabel(plan, superseded)} · {riskLabel(plan)}
              </span>
            </div>
            <h4 className="text-lg font-semibold text-slate-950 dark:text-white">{plan.summary}</h4>
            <p className="mt-2 text-xs text-text-slate dark:text-text-stone">
              {targetLabel(plan.target)} · {modeLabel(plan.mode)} · {stats.agents} 智能体 ·{' '}
              {stats.skills} 技能 · {stats.workflows} 工作流
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="rounded-2xl border border-hairline-soft bg-canvas px-3 py-2 text-xs font-semibold text-text-charcoal hover:bg-surface-soft dark:border-white/10 dark:bg-canvas/[0.04] dark:text-text-secondary dark:hover:bg-canvas/10"
              >
                收起
              </button>
            )}
            {onStartBuild && plan.status !== 'applied' && (
              <button
                type="button"
                onClick={onStartBuild}
                disabled={!canBuild || isBuilding}
                title={applyBlockedReason}
                className="rounded-2xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal disabled:opacity-50"
              >
                {applyActionLabel(plan, isBuilding)}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {buildResult && plan.status === 'applied' && (
          <div className="rounded-2xl border border-emerald-200 bg-teal-light p-4 dark:border-emerald-500/20 dark:bg-brand-teal/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-moss-dark dark:text-emerald-200">
              构建交付完成
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              创建 {buildResult.createdAgents.length} 个智能体 · 更新{' '}
              {buildResult.updatedAgents.length} 个智能体 · 工作流{' '}
              {buildResult.createdWorkflows.length + buildResult.updatedWorkflows.length} 项 ·
              技能文件 {buildResult.changedSkills.length} 项
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-h-[104px] rounded-2xl border border-hairline-soft bg-surface-soft p-4 dark:border-white/10 dark:bg-black/20">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-text-stone">
              将发生什么
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              {stats.agents + stats.skills + stats.workflows}
            </p>
            <p className="mt-1 text-xs text-text-slate dark:text-text-stone">
              项资源变更 · {stats.agents} 智能体 · {stats.skills} 技能 · {stats.workflows} 工作流
            </p>
          </div>
          <div className="min-h-[104px] rounded-2xl border border-hairline-soft bg-surface-soft p-4 dark:border-white/10 dark:bg-black/20">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-text-stone">
              {aiBuilderUi.stepLabel}
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              {dryRunLoading ? '…' : plan.dryRun ? plan.dryRun.changes.length : '—'}
            </p>
            <p className="mt-1 text-xs text-text-slate dark:text-text-stone">
              {dryRunLoading
                ? '预览运行中'
                : plan.dryRun?.errors.length
                  ? `${plan.dryRun.errors.length} 个阻塞错误`
                  : plan.dryRun
                    ? '预览变更数'
                    : '等待自动预览'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-hairline-soft bg-surface-soft p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-black/20">
          {[
            {
              label: aiBuilderUi.resultPreview,
              active: dryRunLoading || Boolean(plan.dryRun),
              done: Boolean(plan.dryRun)
            },
            {
              label: '风险确认',
              active: Boolean(plan.dryRun?.riskPolicy?.hasHighRisk),
              done: Boolean(plan.dryRun && !plan.dryRun.riskPolicy?.hasHighRisk)
            },
            {
              label: '确认写库',
              active: plan.status === 'building',
              done: plan.status === 'applied'
            }
          ].map((step, index) => (
            <div key={step.label} className="flex min-h-[40px] items-center gap-2 text-xs">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.done
                    ? 'bg-ink text-white'
                    : step.active
                      ? 'bg-amber-500 text-white'
                      : 'bg-canvas text-text-slate dark:bg-canvas/10 dark:text-text-stone'
                }`}
              >
                {index + 1}
              </span>
              <span className="font-semibold text-text-charcoal dark:text-text-secondary">
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {dryRunLoading && (
          <IndeterminateProgressBar label={aiBuilderUi.runningPreview} tone="indigo" />
        )}

        {dryRunFailed && !dryRunLoading && !plan.dryRun && onRetryDryRun && (
          <div className="flex flex-col gap-3 rounded-2xl border border-coral-light bg-coral-light p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-500/20 dark:bg-brand-coral/10">
            <p className="text-xs text-red-800 dark:text-red-100">{aiBuilderUi.failed}</p>
            <button
              type="button"
              onClick={onRetryDryRun}
              className="inline-flex h-8 shrink-0 items-center rounded-2xl border border-coral-light bg-canvas px-3 text-xs font-semibold text-red-700 hover:bg-coral-light dark:border-red-500/30 dark:bg-brand-coral/10 dark:text-red-200"
            >
              {aiBuilderUi.retry}
            </button>
          </div>
        )}

        {!canBuild &&
          applyBlockedReason &&
          plan.status !== 'applied' &&
          plan.status !== 'building' && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
              {applyBlockedReason}
            </p>
          )}

        {agentCapabilityChanges.length > 0 && (
          <div className="rounded-2xl border border-hairline-soft bg-surface-soft p-4 dark:border-white/10 dark:bg-black/20">
            <SectionTitle>Agent 能力</SectionTitle>
            <div className="space-y-3">
              {agentCapabilityChanges.map(({ action, agent }, index) => (
                <div
                  key={`${agent.id || agent.name}_${index}`}
                  className="rounded-2xl border border-hairline-soft bg-canvas p-3 text-xs dark:border-white/10 dark:bg-canvas/[0.04]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-ink dark:text-white">
                      {action} · {agent.name || agent.id}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                      {agentRuntimeSummary(agent)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="rounded-xl bg-surface-soft px-3 py-2 text-text-slate dark:bg-black/20 dark:text-text-stone">
                      工具：{compactIds(agent.toolIds)}
                    </p>
                    <p className="rounded-xl bg-surface-soft px-3 py-2 text-text-slate dark:bg-black/20 dark:text-text-stone">
                      技能：{compactIds(agent.skillIds)}
                    </p>
                    <p className="rounded-xl bg-surface-soft px-3 py-2 text-text-slate dark:bg-black/20 dark:text-text-stone">
                      MCP：{compactIds(agent.mcpServerIds)}
                    </p>
                    <p className="rounded-xl bg-surface-soft px-3 py-2 text-text-slate dark:bg-black/20 dark:text-text-stone">
                      契约：{agentContractState(agent)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <SectionTitle>提醒</SectionTitle>
            <div className="space-y-2">
              {plan.warnings.map((warning, index) => (
                <p
                  key={`${warning}_${index}`}
                  className="text-xs leading-5 text-amber-800 dark:text-amber-100"
                >
                  {warning}
                </p>
              ))}
            </div>
          </div>
        )}

        {plan.validation.errors.length > 0 && (
          <div className="rounded-2xl border border-coral-light bg-coral-light p-4 dark:border-red-500/20 dark:bg-brand-coral/10">
            <SectionTitle>校验错误</SectionTitle>
            <div className="space-y-2">
              {plan.validation.errors.map((error, index) => (
                <p
                  key={`${error}_${index}`}
                  className="text-xs leading-5 text-red-800 dark:text-red-100"
                >
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}

        {(plan.questions?.length || 0) > 0 && plan.validation.status !== 'ok' && (
          <PlanQuestionForm
            questions={plan.questions as Array<string | PlanQuestion>}
            onSubmit={onAnswersSubmit}
          />
        )}

        {(plan.capabilityGraph || plan.contract) && (
          <details className="overflow-hidden rounded-2xl border border-hairline-soft dark:border-white/10">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-text-slate dark:text-text-stone">
              架构详情（能力图 / 契约）
            </summary>
            <div className="grid gap-3 border-t border-hairline-soft p-4 lg:grid-cols-2 dark:border-white/10">
              <CapabilityGraphView graph={plan.capabilityGraph} compact />
              <PlanContractPanel contract={plan.contract} compact />
            </div>
          </details>
        )}

        {isBuilding && <BuildProgressBar step={applyStep} total={applyTotal} />}

        {buildLog.length > 0 && (
          <div className="rounded-2xl border border-hairline-soft bg-surface-soft p-4 dark:border-white/10 dark:bg-black/20">
            <SectionTitle>构建进度</SectionTitle>
            {(isBuilding
              ? buildLog.slice(-5)
              : buildLog.slice(plan.status === 'applied' ? -3 : 0)
            ).map((item, index) => (
              <p
                key={`${item}_${index}`}
                className="text-xs leading-5 text-text-charcoal dark:text-text-secondary"
              >
                {item}
              </p>
            ))}
          </div>
        )}

        {buildError && <BuildErrorPanel error={buildError} />}

        {plan.dryRun && (
          <details
            open={dryRunOpen}
            onToggle={(event) => setDryRunOpen((event.target as HTMLDetailsElement).open)}
            className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface-soft dark:border-white/10 dark:bg-black/20"
          >
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-text-slate dark:text-text-stone">
              {aiBuilderUi.diffPreview(plan.dryRun.changes.length)}
            </summary>
            <div className="space-y-2 border-t border-hairline-soft p-4 dark:border-white/10">
              {plan.dryRun.riskPolicy?.hasHighRisk && (
                <div className="rounded-2xl border border-coral-light bg-coral-light p-3 text-xs text-red-800 dark:border-red-500/20 dark:bg-brand-coral/10 dark:text-red-100">
                  高风险变更需要二次确认：{plan.dryRun.riskPolicy.highRiskChangeIds.join('、')}
                </div>
              )}
              {!plan.dryRun.dryRunToken && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  {aiBuilderUi.noServerToken}
                </div>
              )}
              {plan.dryRun.warnings.map((warning, index) => (
                <p key={`dry_warn_${index}`} className="text-xs text-amber-700 dark:text-amber-200">
                  {warning}
                </p>
              ))}
              {plan.dryRun.errors.map((error, index) => (
                <p key={`dry_error_${index}`} className="text-xs text-red-700 dark:text-red-200">
                  {error}
                </p>
              ))}
              {plan.dryRun.changes.map((change, index) => (
                <details
                  key={`${change.action}_${change.resourceId}_${index}`}
                  className="overflow-hidden rounded-2xl border border-hairline-soft bg-canvas dark:border-white/10 dark:bg-canvas/[0.04]"
                >
                  <summary className="cursor-pointer px-3 py-2.5 text-xs">
                    <span className="font-semibold text-text-ink dark:text-white">
                      {change.title}
                    </span>
                    <span className="ml-2 text-text-slate">
                      {change.operation} · {change.riskLevel}
                    </span>
                  </summary>
                  <pre className="max-h-48 overflow-auto border-t border-hairline-soft p-3 text-[11px] text-text-charcoal dark:border-white/10 dark:text-text-secondary">
                    {formatJson(change.fieldChanges)}
                  </pre>
                </details>
              ))}
            </div>
          </details>
        )}

        {plan.workflowPlan && (
          <div>
            <SectionTitle>业务链路</SectionTitle>
            <div className="space-y-3">
              {plan.workflowPlan.steps.map((step, index) => {
                const kind = step.kind;
                const kindLabel = STEP_KIND_LABELS[kind] || kind;
                const kindColor =
                  STEP_KIND_COLORS[kind] ||
                  'bg-surface text-text-charcoal dark:bg-canvas/10 dark:text-text-secondary';
                const isPipeline = PIPELINE_KINDS.has(kind);
                const refDescription = isPipeline
                  ? summarizeStepConfig(step) || '使用 catalog 缺省 config'
                  : step.resourceRef ||
                    (step.needsNewAgent
                      ? '将新建智能体'
                      : step.needsNewSkill
                        ? '将新建技能'
                        : '待补 resourceRef');
                const canEditPipeline =
                  isPipeline &&
                  Boolean(onPlanEdited) &&
                  !superseded &&
                  plan.status !== 'building' &&
                  plan.status !== 'applied';
                return (
                  <div
                    key={`${step.id}_${index}`}
                    className="rounded-2xl border border-hairline-soft bg-surface-soft p-4 text-xs dark:border-white/10 dark:bg-black/20"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text-ink dark:text-white">
                        {index + 1}. {step.goal || step.id}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kindColor}`}
                      >
                        {kindLabel}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-text-slate dark:text-text-stone">
                      {refDescription} · 输出 {step.produces?.join(', ') || '未声明'}
                    </p>
                    {canEditPipeline && (
                      <PipelineStepConfigEditor
                        step={step}
                        onSave={(updates) => {
                          if (!onPlanEdited || !plan.workflowPlan) return;
                          const nextSteps = plan.workflowPlan.steps.map((current, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...current,
                                  config: updates.config,
                                  configOverrides: updates.configOverrides
                                }
                              : current
                          );
                          onPlanEdited({
                            ...plan,
                            workflowPlan: { ...plan.workflowPlan, steps: nextSteps },
                            status: 'pending_validation',
                            dryRun: undefined,
                            validation: { ...plan.validation, status: 'ok', errors: [] }
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {plan.resourceChanges.length > 0 && (
          <div>
            <SectionTitle>资源变更</SectionTitle>
            <div className="space-y-3">
              {plan.resourceChanges.map((change, index) => (
                <details
                  key={`${change.action}_${index}`}
                  className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface-soft dark:border-white/10 dark:bg-black/20"
                >
                  <summary className="cursor-pointer px-4 py-3 text-xs">
                    <span className="font-semibold text-text-ink dark:text-white">
                      {actionLabel(change)}
                    </span>
                    <span className="ml-2 text-text-slate">{changeTitle(change)}</span>
                  </summary>
                  <pre className="max-h-64 overflow-auto border-t border-hairline-soft p-3 text-[11px] text-text-charcoal dark:border-white/10 dark:text-text-secondary">
                    {formatJson(change)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}

        {onPlanEdited && !superseded && plan.status !== 'building' && plan.status !== 'applied' && (
          <details className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface-soft dark:border-white/10 dark:bg-black/20">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-text-charcoal dark:text-text-secondary">
              结构化计划编辑器
            </summary>
            <div className="space-y-3 border-t border-hairline-soft p-4 dark:border-white/10">
              <label className="block text-xs font-semibold text-text-slate dark:text-text-stone">
                摘要
                <input
                  value={summaryDraft}
                  onChange={(event) => setSummaryDraft(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-hairline-soft bg-canvas px-3 py-2 text-xs text-text-ink outline-none focus:border-slate-400 dark:border-white/10 dark:bg-canvas/[0.06] dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-text-slate dark:text-text-stone">
                Workflow Plan
                <textarea
                  value={workflowPlanDraft}
                  onChange={(event) => setWorkflowPlanDraft(event.target.value)}
                  rows={6}
                  className="mt-1 w-full rounded-2xl border border-hairline-soft bg-canvas px-3 py-2 font-mono text-[11px] text-text-ink outline-none focus:border-slate-400 dark:border-white/10 dark:bg-canvas/[0.06] dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-text-slate dark:text-text-stone">
                Resource Changes
                <textarea
                  value={resourceChangesDraft}
                  onChange={(event) => setResourceChangesDraft(event.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-2xl border border-hairline-soft bg-canvas px-3 py-2 font-mono text-[11px] text-text-ink outline-none focus:border-slate-400 dark:border-white/10 dark:bg-canvas/[0.06] dark:text-white"
                />
              </label>
              {editError && (
                <p className="text-xs text-coral-dark dark:text-red-300">{editError}</p>
              )}
              <button
                type="button"
                onClick={saveStructuredEdit}
                className="rounded-2xl bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-charcoal dark:bg-canvas dark:text-text-ink"
              >
                保存为新计划版本
              </button>
            </div>
          </details>
        )}

        <details className="overflow-hidden rounded-2xl border border-hairline-soft dark:border-white/10">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-text-slate dark:text-text-stone">
            技术详情 JSON
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-hairline-soft bg-surface-soft p-4 text-[11px] text-text-charcoal dark:border-white/10 dark:bg-black/20 dark:text-text-secondary">
            {formatJson(plan)}
          </pre>
        </details>
      </div>
    </section>
  );
};
