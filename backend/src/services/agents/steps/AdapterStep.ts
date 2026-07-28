import { ADAPTER_ALL_VALUE } from '../../../config/businessEnums.js';
import { LogService } from '../../LogService.js';
import { renderTemplate } from '../workflowExpressions.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

/**
 * adapter 步骤：调一个数据源适配器抓取数据。
 *
 * 配置：
 *  - adapter: string  适配器名；支持 'all' 表示全量同步
 *  - date?: string    抓取日期（默认运行时的 __date）
 *  - extraConfig?: object  附加 config，会浅合并到适配器的 itemConfig
 *
 * 输入兼容：
 *  - 若 step.config 缺省，会尝试用 resolvedInput.{adapter,date,extraConfig}
 *
 * 输出：
 *  - { adapter, date, count, message }
 */
export const adapterStepExecutor: StepExecutor = async (ctx: StepExecutionContext) => {
  const cfg = resolveConfig(ctx);
  const adapter = cfg.adapter?.trim();
  if (!adapter) {
    throw new Error('adapter step requires "adapter" in config');
  }

  const date = cfg.date || ctx.date;
  LogService.info(`[Step:adapter] running adapter=${adapter} date=${date || 'today'}`);

  ctx.emit?.({
    type: 'step_progress',
    stepId: ctx.step.id,
    displayName: ctx.step.displayName || ctx.step.id,
    message: `开始采集 ${adapter}`
  });

  if (adapter === 'all') {
    const result = await ctx.taskService.runDailyIngestion(date, cfg.extraConfig, async (p) => {
      ctx.emit?.({
        type: 'step_progress',
        stepId: ctx.step.id,
        displayName: ctx.step.displayName || ctx.step.id,
        message: `采集进度 ${p}%`,
        progress: p
      });
    });
    return {
      adapter,
      date,
      count: result.count,
      message: `全量采集完成（${result.count} 条）`
    };
  }

  const result = await ctx.taskService.runSingleAdapterIngestion(
    adapter,
    date,
    cfg.extraConfig,
    async (p) => {
      ctx.emit?.({
        type: 'step_progress',
        stepId: ctx.step.id,
        displayName: ctx.step.displayName || ctx.step.id,
        message: `采集进度 ${p}%`,
        progress: p
      });
    }
  );
  return {
    adapter,
    date,
    count: result.count,
    message: `适配器 ${adapter} 采集完成（${result.count} 条）`
  };
};

interface AdapterStepConfig {
  adapter?: string;
  date?: string;
  extraConfig?: Record<string, unknown>;
}

function resolveConfig(ctx: StepExecutionContext): AdapterStepConfig {
  const baseCfg = ctx.step.config || {};
  const rendered = renderTemplate(baseCfg, buildScope(ctx)) as Record<string, unknown>;
  const input =
    ctx.resolvedInput && typeof ctx.resolvedInput === 'object' && !Array.isArray(ctx.resolvedInput)
      ? (ctx.resolvedInput as Record<string, unknown>)
      : {};
  return {
    adapter: (rendered.adapter as string) ?? (input.adapter as string) ?? undefined,
    date: (rendered.date as string) ?? (input.date as string) ?? undefined,
    extraConfig:
      (rendered.extraConfig as Record<string, unknown>) ??
      (input.extraConfig as Record<string, unknown>) ??
      undefined
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

export const adapterStepDefinition: WorkflowStepTypeDefinition = {
  type: 'adapter',
  label: '数据源采集',
  icon: 'cloud_download',
  color: 'sky',
  category: 'pipeline',
  description: '调用数据源适配器抓取 RSS / API，写入 source_data。',
  defaultConfig: {
    adapter: ADAPTER_ALL_VALUE
  },
  configSchema: {
    fields: [
      {
        key: 'adapter',
        label: '采集目标',
        type: 'select',
        required: true,
        description: '选择"全部已启用适配器"或指定单个适配器。',
        // 实际选项由 catalog runtime 注入 adapters 列表
        options: [{ value: ADAPTER_ALL_VALUE, label: '全部已启用适配器' }],
        group: '基础',
        allowVariables: true
      },
      {
        key: 'date',
        label: '抓取日期',
        type: 'date',
        description: '缺省时使用调度运行日 ${date}',
        allowVariables: true,
        group: '基础'
      }
    ]
  },
  executor: adapterStepExecutor
};
