import type { LocalStore } from '../../LocalStore.js';
import { LogService } from '../../LogService.js';
import { renderTemplate } from '../workflowExpressions.js';
import {
  buildWorkflowStepApproval,
  shouldGateWorkflowTool,
  WorkflowStepApprovalRequired
} from '../WorkflowStepApproval.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

/**
 * kv-write 步骤：把上游产物落到 LocalStore 的 KV 存储。
 *
 * config:
 *  - key: string                必需，目标 key（支持模板）
 *  - value: unknown             可选，要写入的值；缺省时写入 resolvedInput
 *  - indexKey?: string          可选索引 key
 *  - indexValue?: string        可选要追加到索引数组里的值；缺省取 key 后缀
 *  - indexOrder?: 'asc' | 'desc'   默认 desc
 *  - ttlSec?: number            可选 TTL
 *
 * 输出：{ key, indexKey, indexed, written: true }
 */
export const kvWriteStepExecutor: StepExecutor = async (ctx) => {
  const cfg = resolveConfig(ctx);
  const key = (cfg.key || '').trim();
  if (!key) {
    throw new Error('kv-write step requires "key"');
  }

  const value = cfg.value !== undefined ? cfg.value : ctx.resolvedInput;
  if (value === undefined || value === null) {
    LogService.warn(`[Step:kv-write] empty value for key=${key}, skip`);
    return { key, written: false, reason: 'empty_value' };
  }

  const runtime = ctx.runOptions?.runtimeOptions ?? {};
  const needsApproval =
    cfg.requireApproval === true || isPublishLikeKvKey(key, cfg.indexKey);
  if (needsApproval && shouldGateWorkflowTool('kv-write', runtime)) {
    const workflowRunId = runtime.workflowRunId as string | undefined;
    if (!workflowRunId) {
      throw new Error(`kv-write step ${ctx.step.id} requires approval but workflowRunId is missing`);
    }
    throw new WorkflowStepApprovalRequired(
      buildWorkflowStepApproval({
        workflowRunId,
        workflowId: ctx.workflow.id,
        workflowName: ctx.workflow.name,
        step: ctx.step,
        toolId: 'kv-write',
        toolInput: { key, value, indexKey: cfg.indexKey, indexValue: cfg.indexValue },
        stepResults: ctx.stepResults,
        date: ctx.date,
        runtimeOptions: runtime
      })
    );
  }

  return executeKvWrite(ctx.store, {
    key,
    value,
    indexKey: cfg.indexKey,
    indexValue: cfg.indexValue,
    indexOrder: cfg.indexOrder,
    ttlSec: cfg.ttlSec
  });
};

export interface KvWriteInput {
  key: string;
  value: unknown;
  indexKey?: string;
  indexValue?: string;
  indexOrder?: 'asc' | 'desc';
  ttlSec?: number;
}

export async function executeKvWrite(store: LocalStore, input: KvWriteInput) {
  await store.put(input.key, input.value, input.ttlSec);

  let indexed = false;
  if (input.indexKey) {
    const indexKey = input.indexKey.trim();
    const existing = (await store.get(indexKey)) as unknown;
    const indexValue = input.indexValue || extractIndexValue(input.key);
    if (indexValue) {
      const set = new Set<string>(Array.isArray(existing) ? (existing as string[]) : []);
      set.add(indexValue);
      const next = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
      if (input.indexOrder === 'asc') next.reverse();
      await store.put(indexKey, next);
      indexed = true;
    }
  }

  return { key: input.key, indexKey: input.indexKey, indexed, written: true };
}

interface KvWriteStepConfig {
  key?: string;
  value?: unknown;
  indexKey?: string;
  indexValue?: string;
  indexOrder?: 'asc' | 'desc';
  ttlSec?: number;
  requireApproval?: boolean;
}

function isPublishLikeKvKey(key: string, indexKey?: string): boolean {
  if (key.startsWith('daily_report_json:')) return true;
  if (indexKey === 'daily_report_json_index') return true;
  return false;
}

function resolveConfig(ctx: StepExecutionContext): KvWriteStepConfig {
  const scope = {
    ...ctx.stepResults,
    input: ctx.resolvedInput,
    current: ctx.resolvedInput,
    __date: ctx.date,
    __workflow: { id: ctx.workflow.id, name: ctx.workflow.name }
  };
  const baseCfg = ctx.step.config || {};
  const rendered = renderTemplate(baseCfg, scope) as Record<string, unknown>;
  return {
    key: rendered.key as string,
    value: rendered.value,
    indexKey: rendered.indexKey as string | undefined,
    indexValue: rendered.indexValue as string | undefined,
    indexOrder: (rendered.indexOrder as KvWriteStepConfig['indexOrder']) || 'desc',
    ttlSec: rendered.ttlSec as number | undefined,
    requireApproval: rendered.requireApproval === true
  };
}

function extractIndexValue(key: string): string | undefined {
  const idx = key.lastIndexOf(':');
  if (idx < 0) return undefined;
  return key.slice(idx + 1) || undefined;
}

export const kvWriteStepDefinition: WorkflowStepTypeDefinition = {
  type: 'kv-write',
  label: '键值存储',
  icon: 'inventory_2',
  color: 'violet',
  category: 'pipeline',
  description: '把上游产物写入 LocalStore 的 KV。',
  defaultConfig: {
    key: '',
    value: '$.current',
    indexKey: '',
    indexValue: ''
  },
  configSchema: {
    fields: [
      {
        key: 'key',
        label: '存储键',
        type: 'string',
        required: true,
        allowVariables: true,
        placeholder: '${input.id}',
        description: '可用 ${input.xxx} 模板。',
        group: '存储'
      },
      {
        key: 'value',
        label: '写入值',
        type: 'json',
        description: '默认写入 resolvedInput；用表达式可指定 $.xxx 路径。',
        allowVariables: true,
        placeholder: '$.current',
        group: '存储'
      },
      {
        key: 'ttlSec',
        label: 'TTL（秒）',
        type: 'number',
        min: 0,
        description: '0 / 留空表示不过期。',
        group: '存储'
      },
      {
        key: 'indexKey',
        label: '索引键',
        type: 'string',
        description: '可选；在该索引数组里追加 indexValue。',
        group: '索引'
      },
      {
        key: 'indexValue',
        label: '索引值',
        type: 'string',
        allowVariables: true,
        description: '缺省时自动取 key 的最后一段。',
        group: '索引'
      },
      {
        key: 'indexOrder',
        label: '索引排序',
        type: 'select',
        default: 'desc',
        options: [
          { value: 'desc', label: '新→旧（默认）' },
          { value: 'asc', label: '旧→新' }
        ],
        group: '索引'
      },
      {
        key: 'requireApproval',
        label: '写入前需审批',
        type: 'boolean',
        default: false,
        description: '为 true 时，或 key 为日报发布类键时，写入前进入审批工作台。',
        group: '治理'
      }
    ]
  },
  executor: kvWriteStepExecutor
};
