import { aiBuilderUi } from '../../../copy/aiBuilderUi';
import type {
  AiBuildPlan,
  BuilderMode,
  BuilderStateGraph,
  BuilderStateId,
  PlanContract,
  PlanDraft
} from '../../../services/agentService';

export interface BuilderGateResult {
  ok: boolean;
  reason?: string;
}

export interface BuilderGateContext {
  draft?: PlanDraft | null;
  plan?: AiBuildPlan | null;
  contract?: PlanContract | null;
  hasOpenPlanQuestions?: boolean;
  isStreaming?: boolean;
  isApplying?: boolean;
  builderMode?: BuilderMode;
}

const STATE_ORDER: BuilderStateId[] = ['chat', 'plan', 'build', 'dryRun', 'apply', 'result'];

const STATE_META: Record<BuilderStateId, { label: string; description: string }> = {
  chat: { label: '对话', description: '自由讨论目标、引用资源、探索能力边界' },
  plan: { label: '计划', description: '澄清问题、沉淀方案草稿、确认风险' },
  build: { label: '构建评审', description: '从草稿生成可审阅的构建计划' },
  dryRun: { label: aiBuilderUi.stepLabel, description: aiBuilderUi.stepDescription },
  apply: { label: '写库', description: '用户确认后应用资源变更' },
  result: { label: '结果', description: '查看交付摘要、失败原因和可回退节点' }
};

function busyReason(context: BuilderGateContext) {
  if (context.isApplying) return '构建进行中，请等待或取消';
  if (context.isStreaming) return '生成进行中，请等待或中断';
  return undefined;
}

export function dryRunIsOk(plan?: AiBuildPlan | null) {
  if (!plan?.dryRun) return false;
  if ((plan.dryRun.errors?.length || 0) > 0) return false;
  if (plan.validation.status !== 'ok') return false;
  return Boolean(plan.dryRun.dryRunToken);
}

export function contractReadyForBuild(contract?: PlanContract | null, draft?: PlanDraft | null) {
  if (draft?.status === 'needs_input') return false;
  if (contract?.status === 'draft') return false;
  return contract?.status === 'ready' || draft?.status === 'ready_for_build';
}

export function contractLockedForApply(contract?: PlanContract | null, plan?: AiBuildPlan | null) {
  if (contract?.status === 'locked') return true;
  return plan?.validation.status === 'ok' && Boolean(plan?.contract?.status === 'locked');
}

export function canGenerateBuildPlan(context: BuilderGateContext): BuilderGateResult {
  const busy = busyReason(context);
  if (busy) return { ok: false, reason: busy };
  if (!context.draft) return { ok: false, reason: '需要先生成计划草稿' };
  if (context.hasOpenPlanQuestions) return { ok: false, reason: '请先回答计划澄清问题' };
  if ((context.draft.questions?.length || 0) > 0)
    return { ok: false, reason: '草稿仍有待确认问题' };
  const contract = context.contract || context.draft.contract;
  if (!contractReadyForBuild(contract, context.draft)) {
    return { ok: false, reason: '计划契约尚未就绪，请继续完善方案' };
  }
  return { ok: true };
}

function applyActionLabel(plan?: AiBuildPlan | null) {
  return plan?.dryRun?.riskPolicy?.hasHighRisk ? '高风险二次确认并写库' : '确认写库';
}

export function canApplyBuildPlan(context: BuilderGateContext): BuilderGateResult {
  const busy = busyReason(context);
  if (busy) return { ok: false, reason: busy };
  if (!context.plan) return { ok: false, reason: '需要先生成构建计划' };
  if (context.plan.status === 'building') return { ok: false, reason: '写库进行中' };
  if (context.plan.status === 'applied') return { ok: false, reason: '该计划已写库完成' };
  if (context.plan.validation.status !== 'ok') {
    const firstError = context.plan.validation.errors?.[0];
    return {
      ok: false,
      reason: firstError ? `构建计划未通过校验：${firstError}` : '构建计划未通过校验'
    };
  }
  const contract = context.contract || context.plan.contract;
  if (!contractLockedForApply(contract, context.plan)) {
    return { ok: false, reason: '计划契约未锁定，请回到 Plan 修订或重新生成构建计划' };
  }
  if (!context.plan.dryRun) {
    return { ok: false, reason: '等待写库前校验生成确认凭证' };
  }
  const dryRunErrors = context.plan.dryRun.errors?.length || 0;
  if (dryRunErrors > 0) return { ok: false, reason: aiBuilderUi.blockedErrors(dryRunErrors) };
  if (!context.plan.dryRun.dryRunToken) return { ok: false, reason: aiBuilderUi.tokenMissing };
  if (!dryRunIsOk(context.plan)) {
    return { ok: false, reason: aiBuilderUi.notPassed };
  }
  return { ok: true };
}

export function canEnterBuildReview(context: BuilderGateContext): BuilderGateResult {
  const busy = busyReason(context);
  if (busy) return { ok: false, reason: busy };
  if (!context.plan) return { ok: false, reason: '需要先生成构建计划' };
  return { ok: true };
}

function stateForMode(mode: BuilderMode): BuilderStateId {
  if (mode === 'plan') return 'plan';
  if (mode === 'build') return 'build';
  return 'chat';
}

function resolveCurrentState(context: BuilderGateContext): BuilderStateId {
  const plan = context.plan;
  if (plan?.status === 'applied') return 'result';
  if (plan?.status === 'failed') return 'result';
  if (context.isApplying) return 'apply';
  if (plan?.dryRun) return 'dryRun';
  if (plan) return 'build';
  if (context.draft) return 'plan';
  return stateForMode(context.builderMode || 'chat');
}

function fallbackNextActions(current: BuilderStateId, context: BuilderGateContext) {
  const generateGate = canGenerateBuildPlan(context);
  const applyGate = canApplyBuildPlan(context);
  if (current === 'chat') {
    return [{ id: 'switch_plan', label: '进入计划', targetState: 'plan' as const, primary: true }];
  }
  if (current === 'plan') {
    return [
      {
        id: 'continue_plan',
        label: '继续规划',
        targetState: 'plan' as const,
        primary: !context.draft
      },
      {
        id: 'enter_build',
        label: '生成构建计划',
        targetState: 'build' as const,
        primary: generateGate.ok,
        disabled: !generateGate.ok,
        reason: generateGate.reason
      }
    ];
  }
  if (current === 'build' || current === 'dryRun') {
    return [
      {
        id: 'confirm_apply',
        label: applyActionLabel(context.plan),
        targetState: 'apply' as const,
        primary: true,
        disabled: !applyGate.ok,
        reason: applyGate.reason
      }
    ];
  }
  return [
    { id: 'continue_plan', label: '基于结果继续规划', targetState: 'plan' as const, primary: true }
  ];
}

export function computeSessionStateGraph(context: BuilderGateContext): BuilderStateGraph {
  const current = resolveCurrentState(context);
  const currentIndex = STATE_ORDER.indexOf(current);
  const hasDraft = Boolean(context.draft);
  const hasPlan = Boolean(context.plan);
  const hasDryRun = Boolean(context.plan?.dryRun);

  const nodes = STATE_ORDER.map((id, index) => ({
    id,
    label: STATE_META[id].label,
    description: STATE_META[id].description,
    status:
      index < currentIndex
        ? ('completed' as const)
        : id === current
          ? ('active' as const)
          : id === 'plan' ||
              (id === 'build' && hasDraft) ||
              (id === 'dryRun' && hasPlan) ||
              (id === 'apply' && hasDryRun)
            ? ('available' as const)
            : ('pending' as const)
  }));

  return {
    current,
    nodes,
    transitions: [],
    nextActions: fallbackNextActions(current, context),
    updatedAt: new Date().toISOString()
  };
}

export function mergeStateGraphWithGates(
  graph: BuilderStateGraph | undefined,
  context: BuilderGateContext
): BuilderStateGraph {
  const base = graph || computeSessionStateGraph(context);
  const generateGate = canGenerateBuildPlan(context);
  const applyGate = canApplyBuildPlan(context);
  const current = graph?.current || resolveCurrentState(context);

  return {
    ...base,
    current,
    nextActions: (base.nextActions?.length
      ? base.nextActions
      : fallbackNextActions(current, context)
    ).map((action) => {
      if (action.id === 'enter_build') {
        return {
          ...action,
          label: '生成构建计划',
          disabled: !generateGate.ok,
          reason: generateGate.reason,
          primary: generateGate.ok
        };
      }
      if (action.id === 'confirm_apply') {
        return {
          ...action,
          label: applyActionLabel(context.plan),
          disabled: !applyGate.ok,
          reason: applyGate.reason,
          primary: applyGate.ok
        };
      }
      return action;
    }),
    updatedAt: new Date().toISOString()
  };
}

export function currentStateLabel(graph?: BuilderStateGraph) {
  const node = graph?.nodes.find((item) => item.id === graph.current);
  return node?.label || graph?.current || '对话';
}
