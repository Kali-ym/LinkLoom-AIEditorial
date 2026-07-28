import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

class CreateCronTool extends BaseTool {
  readonly id = 'create_cron';
  readonly name = 'create_cron';
  readonly displayName = '创建定时任务';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '创建一个定时任务(cron)。必填 name/type/cronExpr/targetId;可选 enabled(默认 true)。' +
    'type=INGESTION 时 targetId 为适配器名或 all;type=WORKFLOW 时 targetId 为工作流 id。' +
    '创建前应先调 list_adapters 或 list_workflows 让用户确认 targetId。';
  readonly parameters = {
    type: 'object',
    properties: {
      name: { type: 'string', description: '任务名称' },
      type: { type: 'string', enum: ['INGESTION', 'WORKFLOW'], description: 'INGESTION=采集适配器, WORKFLOW=跑工作流' },
      cronExpr: { type: 'string', description: 'cron 表达式如 0 8 * * *' },
      targetId: { type: 'string', description: 'INGESTION 时为适配器名或 all;WORKFLOW 时为工作流 id' },
      enabled: { type: 'boolean', description: '创建后是否启用,默认 true' },
    },
    required: ['name', 'type', 'cronExpr', 'targetId'],
  };

  async handler(
    args: {
      name: string;
      type: 'INGESTION' | 'WORKFLOW';
      cronExpr: string;
      targetId: string;
      enabled?: boolean;
    },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const enabled = args.enabled ?? true;
      const schedule = {
        id: `sched_${Date.now()}`,
        name: args.name,
        type: args.type,
        cron: args.cronExpr,
        cronExpr: args.cronExpr,
        targetId: args.targetId,
        enabled,
        createdAt: new Date().toISOString(),
      };
      await store.saveSchedule(schedule);
      if (enabled) services.schedulerService.startSchedule(schedule);
      return { ok: true, schedule };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'CREATE_CRON_FAILED',
        message,
        hint: '检查 cron 表达式格式与 targetId 是否存在',
      };
    }
  }
}

class UpdateCronTool extends BaseTool {
  readonly id = 'update_cron';
  readonly name = 'update_cron';
  readonly displayName = '编辑定时任务';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '编辑或启停一个已存在定时任务。必填 scheduleId + patch(要修改的字段对象,可含 name/type/cronExpr/targetId/enabled)。' +
    '修改前应先调 list_schedules 让用户确认 scheduleId。';
  readonly parameters = {
    type: 'object',
    properties: {
      scheduleId: { type: 'string', description: '要修改的定时任务 id' },
      patch: {
        type: 'object',
        description: '要修改的字段(name/type/cronExpr/targetId/enabled 等)',
        additionalProperties: true,
      },
    },
    required: ['scheduleId', 'patch'],
  };

  async handler(args: { scheduleId: string; patch: Record<string, unknown> }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const existing = await store.getSchedule(args.scheduleId);
      if (!existing) {
        return {
          ok: false,
          errorCode: 'NOT_FOUND',
          message: `定时任务 ${args.scheduleId} 不存在`,
          hint: '调 list_schedules 查看可用任务',
        };
      }
      const updated = { ...existing, ...args.patch, id: args.scheduleId };
      await store.saveSchedule(updated);
      services.schedulerService.stopSchedule(args.scheduleId);
      if (updated.enabled) services.schedulerService.startSchedule(updated);
      return { ok: true, schedule: updated };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'UPDATE_CRON_FAILED', message };
    }
  }
}

class DeleteCronTool extends BaseTool {
  readonly id = 'delete_cron';
  readonly name = 'delete_cron';
  readonly displayName = '删除定时任务';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '删除一个定时任务(高危,不可撤销)。必填 scheduleId。删除前应先调 list_schedules 让用户确认。';
  readonly parameters = {
    type: 'object',
    properties: { scheduleId: { type: 'string', description: '要删除的定时任务 id' } },
    required: ['scheduleId'],
  };

  async handler(args: { scheduleId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      services.schedulerService.stopSchedule(args.scheduleId);
      await store.deleteSchedule(args.scheduleId);
      return { ok: true, deleted: args.scheduleId };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'DELETE_CRON_FAILED', message };
    }
  }
}

class RunScheduleNowTool extends BaseTool {
  readonly id = 'run_schedule_now';
  readonly name = 'run_schedule_now';
  readonly displayName = '立即执行定时任务';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '立即手动执行一个已存在定时任务(不等 cron 触发)。必填 scheduleId。执行前应先调 list_schedules 让用户确认。';
  readonly parameters = {
    type: 'object',
    properties: { scheduleId: { type: 'string', description: '要立即执行的定时任务 id' } },
    required: ['scheduleId'],
  };

  async handler(args: { scheduleId: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const existing = await store.getSchedule(args.scheduleId);
      if (!existing) {
        return { ok: false, errorCode: 'NOT_FOUND', message: `定时任务 ${args.scheduleId} 不存在` };
      }
      const result = await services.schedulerService.runNow(args.scheduleId);
      return { ok: true, scheduleId: args.scheduleId, schedule: existing, result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'RUN_NOW_FAILED',
        message,
        hint: '可在 /scheduling 页面查看运行日志',
      };
    }
  }
}

export const cronTools: BaseTool[] = [
  new CreateCronTool(),
  new UpdateCronTool(),
  new DeleteCronTool(),
  new RunScheduleNowTool(),
];
