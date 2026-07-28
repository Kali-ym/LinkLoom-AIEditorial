import { renderTemplate } from '../workflowExpressions.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

interface KvReadStepConfig {
  key?: string;
  defaultValue?: unknown;
}

function resolveConfig(ctx: StepExecutionContext): KvReadStepConfig {
  const config = ctx.step.config || {};
  return {
    key: typeof config.key === 'string' ? config.key : '',
    defaultValue: config.defaultValue
  };
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

export const kvReadStepExecutor: StepExecutor = async (ctx) => {
  const cfg = resolveConfig(ctx);
  const scope = buildScope(ctx);
  const key = String(renderTemplate(cfg.key || '', scope) || '').trim();
  if (!key) {
    throw new Error('kv-read step requires "key"');
  }

  const raw = await ctx.store.get(key);
  const found = raw !== undefined && raw !== null;
  return {
    key,
    value: found ? raw : cfg.defaultValue,
    found
  };
};

export const kvReadStepDefinition: WorkflowStepTypeDefinition = {
  type: 'kv-read',
  label: 'KV 读取',
  icon: 'database',
  color: 'sky',
  category: 'pipeline',
  description: '从 LocalStore KV 读取键值，支持模板变量。',
  defaultConfig: {
    key: '',
    defaultValue: null
  },
  configSchema: {
    fields: [
      {
        key: 'key',
        label: 'KV 键',
        type: 'string',
        required: true,
        default: '',
        description: '支持 ${__date} 等模板。',
        group: '读取'
      },
      {
        key: 'defaultValue',
        label: '默认值',
        type: 'json',
        required: false,
        default: null,
        description: '键不存在时返回的值。',
        group: '读取'
      }
    ]
  },
  executor: kvReadStepExecutor
};
