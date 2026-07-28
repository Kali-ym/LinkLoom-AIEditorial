import { parseJsonLenient, removeMarkdownCodeBlock } from '../../../utils/helpers.js';
import { LogService } from '../../LogService.js';
import { renderTemplate } from '../workflowExpressions.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

/**
 * store-write 步骤：把上游产物写回 source_data.metadata。
 * 主要替代 SchedulerService.normalizeScoringResult + updateSourceDataMetadata 的硬编码。
 *
 * config:
 *  - target: 'metadata'                目前只支持 metadata
 *  - id: 模板表达式或常量，目标条目 id   (default '$.input.id' 或 '$.item.id')
 *  - patch: object                     metadata 补丁（支持 $.path 引用）
 *  - patchFromInput?: boolean          true 表示直接将 input（或 input.parsed）合并入 metadata
 *  - allowedKeys?: string[]            白名单，避免误写其它字段
 *  - stamp?: string                    自动写入的时间戳字段；留空表示不记录
 *
 * 输出：{ id, written, patch }
 */
export const storeWriteStepExecutor: StepExecutor = async (ctx) => {
  const cfg = resolveConfig(ctx);
  const id = String(cfg.id || '').trim();
  if (!id) {
    throw new Error('store-write step requires a non-empty "id"');
  }

  const existing = await ctx.store.getSourceData(id);
  if (!existing) {
    LogService.warn(`[Step:store-write] source data not found, id=${id}`);
    return { id, written: false, reason: 'not_found' };
  }

  const patch = derivePatch(cfg, ctx);
  if (!patch || Object.keys(patch).length === 0) {
    return { id, written: false, reason: 'empty_patch' };
  }

  const stampField = cfg.stamp;
  const merged: Record<string, unknown> = {
    ...(existing.metadata || {}),
    ...patch
  };
  if (stampField && !merged[stampField]) {
    merged[stampField] = new Date().toISOString();
  }

  await ctx.store.updateSourceDataMetadata(id, merged);
  return { id, written: true, patch };
};

interface StoreWriteStepConfig {
  target?: 'metadata';
  id?: string;
  patch?: Record<string, unknown>;
  patchFromInput?: boolean;
  allowedKeys?: string[];
  stamp?: string | null;
}

function resolveConfig(ctx: StepExecutionContext): StoreWriteStepConfig {
  const scope = buildScope(ctx);
  const baseCfg = ctx.step.config || {};
  const rendered = renderTemplate(baseCfg, scope) as Record<string, unknown>;
  const input =
    ctx.resolvedInput && typeof ctx.resolvedInput === 'object' && !Array.isArray(ctx.resolvedInput)
      ? (ctx.resolvedInput as Record<string, unknown>)
      : {};
  return {
    target: 'metadata',
    id:
      (rendered.id as string) ??
      (input.id as string) ??
      ((input.item as any)?.id as string) ??
      undefined,
    patch: (rendered.patch as Record<string, unknown>) ?? undefined,
    patchFromInput: (rendered.patchFromInput as boolean) ?? false,
    allowedKeys: Array.isArray(rendered.allowedKeys)
      ? rendered.allowedKeys.map(String).filter(Boolean)
      : undefined,
    stamp: typeof rendered.stamp === 'string' ? rendered.stamp : null
  };
}

function derivePatch(
  cfg: StoreWriteStepConfig,
  ctx: StepExecutionContext
): Record<string, unknown> | null {
  let raw: Record<string, unknown> | null = null;

  if (cfg.patch && typeof cfg.patch === 'object') {
    raw = cfg.patch;
  } else if (cfg.patchFromInput) {
    raw = extractPatchFromInput(ctx.resolvedInput);
  } else {
    raw = extractPatchFromInput(ctx.resolvedInput);
  }
  if (!raw) return null;

  if (Array.isArray(cfg.allowedKeys) && cfg.allowedKeys.length > 0) {
    const filtered: Record<string, unknown> = {};
    for (const key of cfg.allowedKeys) {
      if (raw[key] !== undefined) filtered[key] = raw[key];
    }
    return filtered;
  }
  return raw;
}

function extractPatchFromInput(input: unknown): Record<string, unknown> | null {
  if (!input) return null;

  if (typeof input === 'string') {
    const cleaned = removeMarkdownCodeBlock(input);
    const parsed = parseJsonLenient(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  }

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    if (record.parsed && typeof record.parsed === 'object' && !Array.isArray(record.parsed)) {
      return record.parsed as Record<string, unknown>;
    }
    if (record.output && typeof record.output === 'string') {
      return extractPatchFromInput(record.output);
    }
    return record;
  }
  return null;
}

function buildScope(ctx: StepExecutionContext): Record<string, unknown> {
  return {
    ...ctx.stepResults,
    input: ctx.resolvedInput,
    current: ctx.resolvedInput,
    item: (ctx.resolvedInput as any)?.item,
    parsed: (ctx.resolvedInput as any)?.parsed,
    __date: ctx.date,
    __workflow: { id: ctx.workflow.id, name: ctx.workflow.name }
  };
}

export const storeWriteStepDefinition: WorkflowStepTypeDefinition = {
  type: 'store-write',
  label: '写回条目',
  icon: 'edit_note',
  color: 'amber',
  category: 'pipeline',
  description: '把上游产物（如评分结果）合并到 source_data.metadata。',
  defaultConfig: {
    id: '$.item.id',
    patch: '$.item.parsed',
    allowedKeys: [],
    stamp: null
  },
  configSchema: {
    fields: [
      {
        key: 'id',
        label: '条目 ID',
        type: 'string',
        required: true,
        description: '目标 source_data 的 id；通常用 $.item.id 或 $.item.item.id。',
        allowVariables: true,
        placeholder: '$.item.id',
        group: '目标'
      },
      {
        key: 'patch',
        label: 'metadata 补丁',
        type: 'json',
        description: '要合并进 metadata 的对象；可用表达式取上游解析结果。',
        allowVariables: true,
        placeholder: '$.item.parsed',
        group: '内容'
      },
      {
        key: 'patchFromInput',
        label: '使用整个输入作为补丁',
        type: 'boolean',
        description: '勾选后从 resolvedInput 整体或 .parsed 提取，不再读 patch。',
        group: '内容'
      },
      {
        key: 'allowedKeys',
        label: '允许写入的字段',
        type: 'json',
        description: '可选白名单，填写字符串数组；留空数组表示不限制字段，由 workflow 自己声明。',
        default: [],
        placeholder: '["field_a", "field_b"]',
        group: '内容'
      },
      {
        key: 'stamp',
        label: '时间戳字段',
        type: 'string',
        default: null,
        description: '写入时自动设置该字段为当前 ISO 时间；留空表示不记录。',
        group: '高级'
      }
    ]
  },
  executor: storeWriteStepExecutor
};
