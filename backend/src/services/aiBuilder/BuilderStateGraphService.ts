import type {
  BuilderCheckpoint,
  BuilderMode,
  BuilderStateGraph,
  BuilderStateId,
  PlanLineage
} from '../../types/aiBuilder.js';

const STATE_ORDER: BuilderStateId[] = ['chat', 'plan', 'build', 'dryRun', 'apply', 'result'];

const STATE_META: Record<BuilderStateId, { label: string; description: string }> = {
  chat: { label: '对话', description: '自由讨论目标、引用资源、探索能力边界' },
  plan: { label: '计划', description: '澄清问题、沉淀方案草稿、确认风险' },
  build: { label: '构建评审', description: '从草稿锁定可构建计划，审阅资源和契约变化' },
  dryRun: { label: 'Dry-run', description: '预览 diff、校验风险，不写库' },
  apply: { label: '写库', description: '用户确认后应用资源变更' },
  result: { label: '结果', description: '查看交付摘要、失败原因和可回退节点' }
};

function stateForMode(mode: BuilderMode): BuilderStateId {
  if (mode === 'plan') return 'plan';
  if (mode === 'build') return 'build';
  return 'chat';
}

export class BuilderStateGraphService {
  buildGraph(input: {
    mode: BuilderMode;
    hasDraft?: boolean;
    hasPlan?: boolean;
    hasDryRun?: boolean;
    dryRunOk?: boolean;
    contractReady?: boolean;
    contractLocked?: boolean;
    isApplying?: boolean;
    isDone?: boolean;
    isFailed?: boolean;
  }): BuilderStateGraph {
    const current: BuilderStateId =
      input.isDone || input.isFailed
        ? 'result'
        : input.isApplying
          ? 'apply'
          : input.hasDryRun
            ? 'dryRun'
            : input.hasPlan
              ? 'build'
              : stateForMode(input.mode);
    const currentIndex = STATE_ORDER.indexOf(current);
    const nodes = STATE_ORDER.map((id, index) => {
      const meta = STATE_META[id];
      return {
        id,
        label: meta.label,
        description: meta.description,
        status:
          index < currentIndex
            ? ('completed' as const)
            : id === current
              ? ('active' as const)
              : this.isAvailable(id, input)
                ? ('available' as const)
                : ('pending' as const)
      };
    });
    return {
      current,
      nodes,
      transitions: [
        { from: 'chat', to: 'plan', label: '进入计划', available: true },
        {
          from: 'plan',
          to: 'build',
          label: '生成构建计划',
          available: Boolean(input.hasDraft && input.contractReady !== false),
          reason: input.hasDraft
            ? input.contractReady === false
              ? '计划契约尚未就绪'
              : undefined
            : '需要先生成计划草稿'
        },
        {
          from: 'build',
          to: 'dryRun',
          label: '生成 dry-run',
          available: Boolean(input.hasPlan),
          reason: input.hasPlan ? undefined : '需要先生成构建计划'
        },
        {
          from: 'dryRun',
          to: 'apply',
          label: '风险确认并写库',
          available: Boolean(
            input.hasDryRun && input.dryRunOk !== false && input.contractLocked !== false
          ),
          reason: !input.hasDryRun
            ? '需要先完成 dry-run'
            : input.contractLocked === false
              ? '计划契约未锁定'
              : input.dryRunOk === false
                ? 'dry-run 仍有阻塞问题'
                : undefined
        },
        {
          from: 'apply',
          to: 'result',
          label: '查看结果',
          available: Boolean(input.isDone || input.isFailed)
        }
      ],
      nextActions: this.nextActions(current, input),
      updatedAt: new Date().toISOString()
    };
  }

  createCheckpoint(input: {
    type: BuilderCheckpoint['type'];
    summary: string;
    state: BuilderStateId;
    lineage?: PlanLineage;
    answers?: Record<string, unknown>;
    riskAccepted?: boolean;
    partialWriteRisk?: boolean;
  }): BuilderCheckpoint {
    return {
      id: `checkpoint_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      summary: input.summary,
      state: input.state,
      lineage: input.lineage,
      answers: input.answers,
      riskAccepted: input.riskAccepted,
      partialWriteRisk: input.partialWriteRisk,
      createdAt: new Date().toISOString()
    };
  }

  private isAvailable(
    id: BuilderStateId,
    input: { hasDraft?: boolean; hasPlan?: boolean; hasDryRun?: boolean }
  ) {
    if (id === 'plan') return true;
    if (id === 'build') return Boolean(input.hasDraft);
    if (id === 'dryRun') return Boolean(input.hasPlan);
    if (id === 'apply') return Boolean(input.hasDryRun);
    return false;
  }

  private nextActions(
    current: BuilderStateId,
    input: {
      hasDraft?: boolean;
      hasPlan?: boolean;
      hasDryRun?: boolean;
      dryRunOk?: boolean;
      contractReady?: boolean;
      contractLocked?: boolean;
    }
  ) {
    if (current === 'chat') {
      return [
        { id: 'switch_plan', label: '进入计划', targetState: 'plan' as const, primary: true }
      ];
    }
    if (current === 'plan') {
      const canEnterBuild = Boolean(input.hasDraft && input.contractReady !== false);
      return [
        {
          id: 'continue_plan',
          label: '继续规划',
          targetState: 'plan' as const,
          primary: !input.hasDraft
        },
        {
          id: 'enter_build',
          label: '生成构建计划',
          targetState: 'build' as const,
          primary: canEnterBuild,
          disabled: !canEnterBuild,
          reason: !input.hasDraft
            ? '需要先生成计划草稿'
            : input.contractReady === false
              ? '计划契约尚未就绪'
              : undefined
        }
      ];
    }
    if (current === 'build') {
      return [
        {
          id: 'review_dry_run',
          label: '审阅 dry-run',
          targetState: 'dryRun' as const,
          primary: true,
          disabled: !input.hasPlan,
          reason: input.hasPlan ? undefined : '需要先生成构建计划'
        }
      ];
    }
    if (current === 'dryRun') {
      const canApply = Boolean(
        input.hasDryRun && input.dryRunOk !== false && input.contractLocked !== false
      );
      return [
        {
          id: 'confirm_apply',
          label: '风险确认并写库',
          targetState: 'apply' as const,
          primary: canApply,
          disabled: !canApply,
          reason: !input.hasDryRun
            ? '需要先完成 dry-run'
            : input.contractLocked === false
              ? '计划契约未锁定'
              : input.dryRunOk === false
                ? 'dry-run 仍有阻塞问题'
                : undefined
        }
      ];
    }
    return [
      {
        id: 'continue_plan',
        label: '基于结果继续规划',
        targetState: 'plan' as const,
        primary: true
      }
    ];
  }
}
