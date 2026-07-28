import { BATCH_FAILURE_OPTIONS } from '../../../config/businessEnums.js';
import type { WorkflowDefinition, WorkflowStep, WorkflowStepType } from '../../../types/agent.js';
import { parseJsonLenient, removeMarkdownCodeBlock, sleep } from '../../../utils/helpers.js';
import { LogService } from '../../LogService.js';
import { getByPath, renderTemplate, resolveRef } from '../workflowExpressions.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';
import { StepRegistry } from './StepRegistry.js';

/**
 * batch-iterate 步骤：对一个数组按并发循环执行子任务，
 * 替代 SchedulerService.runTimelineScoring 里那段写死的 workers。
 *
 * config:
 *  - itemsPath: string         items 数组的引用路径，如 '$.query.items' 或 '$.input.items'
 *  - concurrency?: number      并发数，默认 1，最大 8
 *  - delay?: number            每个 worker 处理间隔（毫秒），默认 0
 *  - onItemFailure?: 'skip' | 'stop'     默认 'skip'
 *  - child: {
 *      type: 'workflow' | 'agent' | 'tool' | 'store-write' | 'kv-write'
 *      id?: string                   workflowId / agentId / toolId
 *      config?: object               透传给业务 step
 *      inputTemplate?: unknown       渲染子任务输入（默认整条 item）
 *      postSteps?: WorkflowStep[]    可选：每条 item 跑完 child 后再串接的额外步骤
 *    }
 *
 * 输出：{ total, processed, failed, results: [{ item, output, error? }] }
 */
export const batchIterateStepExecutor: StepExecutor = async (ctx) => {
  const cfg = resolveConfig(ctx);
  const items = extractItems(cfg.itemsPath, ctx);
  if (!Array.isArray(items) || items.length === 0) {
    ctx.emit?.({
      type: 'step_progress',
      stepId: ctx.step.id,
      displayName: ctx.step.displayName || ctx.step.id,
      message: '没有可处理的条目'
    });
    return { total: 0, processed: 0, failed: 0, results: [] };
  }

  const concurrency = Math.max(1, Math.min(8, cfg.concurrency || 1));
  const delay = Math.max(0, cfg.delay || 0);
  const onItemFailure = cfg.onItemFailure || 'skip';
  if (!cfg.child) {
    throw new Error('batch-iterate step requires "child" configuration');
  }

  const total = items.length;
  let nextIndex = 0;
  let processed = 0;
  let failed = 0;
  const results: Array<{ item: unknown; output?: unknown; error?: string; parsed?: unknown }> =
    new Array(total);

  let aborted = false;

  const workers = Array(Math.min(concurrency, total))
    .fill(null)
    .map(async (_, workerIndex) => {
      if (workerIndex > 0) await sleep(workerIndex * 150);
      while (!aborted && nextIndex < total) {
        const idx = nextIndex++;
        const item = items[idx];
        try {
          const output = await runChildForItem(item, idx, ctx, cfg);
          let parsed: unknown = undefined;
          if (typeof output === 'string') {
            const cleaned = removeMarkdownCodeBlock(output);
            const json = parseJsonLenient(cleaned);
            if (json && typeof json === 'object') parsed = json;
          } else if (output && typeof output === 'object') {
            parsed = output;
          }
          results[idx] = { item, output, parsed };
          processed++;
        } catch (err: any) {
          const message = err?.message || String(err);
          LogService.error(`[Step:batch-iterate] item ${idx} failed: ${message}`);
          results[idx] = { item, error: message };
          failed++;
          if (onItemFailure === 'stop') {
            aborted = true;
            throw err;
          }
        }
        ctx.emit?.({
          type: 'step_progress',
          stepId: ctx.step.id,
          displayName: ctx.step.displayName || ctx.step.id,
          message: `已处理 ${processed + failed}/${total}`,
          progress: Math.round(((processed + failed) / total) * 100)
        });
        if (delay > 0 && nextIndex < total) await sleep(delay);
      }
    });

  await Promise.all(workers);

  return {
    total,
    processed,
    failed,
    results
  };
};

interface ChildSpec {
  type: WorkflowStepType;
  id?: string;
  config?: Record<string, unknown>;
  inputTemplate?: unknown;
  postSteps?: WorkflowStep[];
}

interface BatchIterateStepConfig {
  itemsPath?: string;
  concurrency?: number;
  delay?: number;
  onItemFailure?: 'skip' | 'stop';
  child?: ChildSpec;
}

function resolveConfig(ctx: StepExecutionContext): BatchIterateStepConfig {
  const baseCfg = ctx.step.config || {};
  const scope = buildScope(ctx);
  const renderedTop = renderTemplate(
    {
      itemsPath: baseCfg.itemsPath,
      concurrency: baseCfg.concurrency,
      delay: baseCfg.delay,
      onItemFailure: baseCfg.onItemFailure
    },
    scope
  ) as Record<string, unknown>;
  const child = baseCfg.child as ChildSpec | undefined;
  return {
    itemsPath: renderedTop.itemsPath as string | undefined,
    concurrency: renderedTop.concurrency as number | undefined,
    delay: renderedTop.delay as number | undefined,
    onItemFailure: renderedTop.onItemFailure as 'skip' | 'stop' | undefined,
    child
  };
}

function extractItems(itemsPath: string | undefined, ctx: StepExecutionContext): unknown[] | null {
  const scope = buildScope(ctx);
  if (itemsPath) {
    const raw = resolveRef(itemsPath, scope);
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray((raw as any).items))
      return (raw as any).items;
    return null;
  }
  if (Array.isArray(ctx.resolvedInput)) return ctx.resolvedInput as unknown[];
  if (ctx.resolvedInput && typeof ctx.resolvedInput === 'object') {
    const items = (ctx.resolvedInput as any).items;
    if (Array.isArray(items)) return items;
  }
  return null;
}

function buildScope(
  ctx: StepExecutionContext,
  item?: unknown,
  index?: number
): Record<string, unknown> {
  return {
    ...ctx.stepResults,
    input: ctx.resolvedInput,
    current: ctx.resolvedInput,
    item,
    index,
    __date: ctx.date,
    __workflow: { id: ctx.workflow.id, name: ctx.workflow.name }
  };
}

async function runChildForItem(
  item: unknown,
  index: number,
  ctx: StepExecutionContext,
  cfg: BatchIterateStepConfig
): Promise<unknown> {
  const child = cfg.child!;
  const scope = buildScope(ctx, item, index);
  const childInput =
    child.inputTemplate !== undefined ? renderTemplate(child.inputTemplate, scope) : item;

  // 调用 child step
  if (child.type === 'workflow') {
    if (!child.id) throw new Error('batch-iterate.child.workflow requires id');
    return await ctx.workflowEngine.runWorkflow(child.id, childInput, ctx.date, {
      ...ctx.runOptions,
      _depth: (ctx.runOptions?._depth ?? 0) + 1
    });
  }

  if (child.type === 'agent') {
    if (!child.id) throw new Error('batch-iterate.child.agent requires id');
    if (!ctx.agentService)
      throw new Error('AgentService not available for batch-iterate child=agent');
    const inputText = typeof childInput === 'string' ? childInput : JSON.stringify(childInput);
    const result = await ctx.agentService.runAgent(child.id, inputText, ctx.date, { silent: true });
    return result?.content ?? result;
  }

  const registry = StepRegistry.getInstance();
  if (registry.has(child.type)) {
    // 复用通用 step executor，将 item 作为 resolvedInput
    const subStep: WorkflowStep = {
      id: `${ctx.step.id}.child[${index}]`,
      type: child.type,
      config: child.config
    };
    const subCtx: StepExecutionContext = {
      ...ctx,
      step: subStep,
      resolvedInput: childInput
    };
    return await registry.execute(child.type, subCtx);
  }

  throw new Error(`batch-iterate child.type "${child.type}" is not supported`);
}

export const batchIterateStepDefinition: WorkflowStepTypeDefinition = {
  type: 'batch-iterate',
  label: '批量循环',
  icon: 'repeat',
  color: 'rose',
  category: 'pipeline',
  description: '对一个数组按并发循环执行子步骤（子工作流 / 智能体 / 写库 / 工具）。',
  defaultConfig: {
    itemsPath: '$.query.items',
    concurrency: 1,
    delay: 0,
    onItemFailure: 'skip',
    child: {
      type: 'workflow',
      id: '',
      inputTemplate: '$.item'
    }
  },
  configSchema: {
    fields: [
      {
        key: 'itemsPath',
        label: '条目数组路径',
        type: 'string',
        required: true,
        allowVariables: true,
        placeholder: '$.query.items',
        description: '指向一个数组的表达式；上游 store-query 的输出可写 $.query.items。',
        group: '循环'
      },
      {
        key: 'concurrency',
        label: '并发数',
        type: 'number',
        default: 1,
        min: 1,
        max: 8,
        allowVariables: true,
        group: '循环'
      },
      {
        key: 'delay',
        label: '单条间隔（毫秒）',
        type: 'number',
        default: 0,
        min: 0,
        allowVariables: true,
        group: '循环'
      },
      {
        key: 'onItemFailure',
        label: '单条失败时',
        type: 'select',
        default: 'skip',
        options: BATCH_FAILURE_OPTIONS,
        group: '循环'
      },
      {
        key: 'child',
        label: '子步骤定义',
        type: 'json',
        description:
          '形如 { type, id?, inputTemplate?, config? }。可选 type：workflow / agent / store-write / kv-write 等。',
        group: '子步骤'
      }
    ]
  },
  executor: batchIterateStepExecutor
};
