import { runTransform } from '../workflowExpressions.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

interface TransformStepConfig {
  operations?: Array<Record<string, unknown>>;
}

function resolveConfig(ctx: StepExecutionContext): TransformStepConfig {
  const config = ctx.step.config || {};
  return {
    operations: Array.isArray(config.operations)
      ? (config.operations as Array<Record<string, unknown>>)
      : []
  };
}

function buildScope(ctx: StepExecutionContext): Record<string, unknown> {
  return {
    ...ctx.stepResults,
    input: ctx.resolvedInput,
    current: ctx.resolvedInput,
    __date: ctx.date,
    __workflow: { id: ctx.workflow.id, name: ctx.workflow.name }
  };
}

export const transformStepExecutor: StepExecutor = async (ctx) => {
  const config = resolveConfig(ctx);
  return runTransform(ctx.resolvedInput, config.operations, buildScope(ctx));
};

export const transformStepDefinition: WorkflowStepTypeDefinition = {
  type: 'transform',
  label: '数据转换',
  icon: 'schema',
  color: 'slate',
  category: 'pipeline',
  description: '使用声明式 operations 对上游数据做 JSON 转换，不调用模型或业务工具。',
  defaultConfig: {
    operations: []
  },
  configSchema: {
    fields: [
      {
        key: 'operations',
        label: '转换操作',
        type: 'json',
        required: true,
        default: [],
        description: '声明式转换操作数组，例如 parseJson、mapArray、wrapResult。',
        group: '转换'
      }
    ]
  },
  executor: transformStepExecutor
};
