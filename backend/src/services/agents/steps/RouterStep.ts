import { evalCondition } from '../workflowExpressions.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

export interface RouterBranchConfig {
  id?: string;
  condition?: Record<string, unknown>;
  nextStepIds?: string[];
}

export interface RouterStepConfig {
  branches?: RouterBranchConfig[];
  defaultNextStepIds?: string[];
}

export interface RouterStepOutput {
  selectedBranch: string;
  selectedNextStepIds: string[];
  input: unknown;
}

function buildScope(ctx: StepExecutionContext): Record<string, unknown> {
  return {
    ...ctx.stepResults,
    input: ctx.resolvedInput,
    current: ctx.resolvedInput,
    __date: ctx.date,
    __runtimeOptions: ctx.runOptions?.runtimeOptions ?? {},
    __workflow: { id: ctx.workflow.id, name: ctx.workflow.name }
  };
}

function resolveConfig(ctx: StepExecutionContext): RouterStepConfig {
  const config = ctx.step.config || {};
  return {
    branches: Array.isArray(config.branches)
      ? (config.branches as RouterBranchConfig[])
      : [],
    defaultNextStepIds: Array.isArray(config.defaultNextStepIds)
      ? (config.defaultNextStepIds as string[])
      : []
  };
}

export function evaluateRouterStep(
  resolvedInput: unknown,
  config: RouterStepConfig,
  scope: Record<string, unknown>
): RouterStepOutput {
  const branches = config.branches || [];
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    if (evalCondition(branch.condition, scope)) {
      return {
        selectedBranch: String(branch.id || `branch_${i}`),
        selectedNextStepIds: Array.isArray(branch.nextStepIds) ? [...branch.nextStepIds] : [],
        input: resolvedInput
      };
    }
  }
  return {
    selectedBranch: 'default',
    selectedNextStepIds: [...(config.defaultNextStepIds || [])],
    input: resolvedInput
  };
}

export const routerStepExecutor: StepExecutor = async (ctx) => {
  const config = resolveConfig(ctx);
  const scope = buildScope(ctx);
  return evaluateRouterStep(ctx.resolvedInput, config, scope);
};

export const routerStepDefinition: WorkflowStepTypeDefinition = {
  type: 'router',
  label: '条件路由',
  icon: 'call_split',
  color: 'amber',
  category: 'pipeline',
  description: '按条件选择后继步骤；未命中分支时使用 defaultNextStepIds。',
  defaultConfig: {
    branches: [],
    defaultNextStepIds: []
  },
  configSchema: {
    fields: [
      {
        key: 'branches',
        label: '分支列表',
        type: 'json',
        required: false,
        default: [],
        description: '每项含 id、condition（path/op/value）、nextStepIds。',
        group: '路由'
      },
      {
        key: 'defaultNextStepIds',
        label: '默认后继',
        type: 'json',
        required: false,
        default: [],
        description: '无分支命中时执行的后继步骤 id 列表。',
        group: '路由'
      }
    ]
  },
  executor: routerStepExecutor
};
