import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

function resolveAdapterStatus(statusMap: unknown, name: string): Record<string, unknown> | undefined {
  if (Array.isArray(statusMap)) {
    return statusMap.find((s: { name?: string }) => s.name === name) as
      | Record<string, unknown>
      | undefined;
  }
  if (statusMap && typeof statusMap === 'object') {
    return (statusMap as Record<string, Record<string, unknown>>)[name];
  }
  return undefined;
}

class ListTaskLogsTool extends BaseTool {
  readonly id = 'list_task_logs';
  readonly name = 'list_task_logs';
  readonly displayName = '列任务运行日志';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '列出定时任务/采集任务的运行日志,含 id/taskId/taskName/startTime/endTime/status/message。' +
    '可选 limit(默认 50)、offset(默认 0)、taskId 按任务筛选。';
  readonly parameters = {
    type: 'object',
    properties: {
      limit: { type: 'number', description: '返回条数,默认 50' },
      offset: { type: 'number', description: '偏移量,默认 0' },
      taskId: { type: 'string', description: '按任务 id 筛选(可选)' },
    },
  };

  async handler(
    args: { limit?: number; offset?: number; taskId?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const logs = await store.listTaskLogs({
        limit: args.limit ?? 50,
        offset: args.offset ?? 0,
        taskId: args.taskId,
      });
      const items = (logs || []).map((log) => ({
        id: log.id,
        taskId: log.taskId,
        taskName: log.taskName,
        startTime: log.startTime,
        endTime: log.endTime,
        status: log.status,
        message: log.message,
      }));
      return { ok: true, count: items.length, items };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'LIST_TASK_LOGS_FAILED',
        message,
        hint: '可在 /scheduling 页面查看运行日志',
      };
    }
  }
}

class GetScheduleDetailTool extends BaseTool {
  readonly id = 'get_schedule_detail';
  readonly name = 'get_schedule_detail';
  readonly displayName = '查定时任务详情';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询单个定时任务的完整详情。必填 scheduleId。用户要查看/确认某个 cron 任务详情时调用。';
  readonly parameters = {
    type: 'object',
    properties: { scheduleId: { type: 'string', description: '定时任务 id' } },
    required: ['scheduleId'],
  };

  async handler(args: { scheduleId: string }, toolCtx?: ToolExecutionContext) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const schedule = await store.getSchedule(args.scheduleId);
      if (!schedule) {
        return {
          ok: false,
          errorCode: 'NOT_FOUND',
          message: `定时任务 ${args.scheduleId} 不存在`,
          hint: '调 list_schedules 查看可用任务',
        };
      }
      return { ok: true, schedule };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'GET_SCHEDULE_FAILED', message };
    }
  }
}

class GetAdapterConfigTool extends BaseTool {
  readonly id = 'get_adapter_config';
  readonly name = 'get_adapter_config';
  readonly displayName = '查适配器配置';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '查询单个采集适配器的配置与运行状态。必填 adapterName。同步或清理前应先调用确认配置。';
  readonly parameters = {
    type: 'object',
    properties: { adapterName: { type: 'string', description: '适配器名称或 id' } },
    required: ['adapterName'],
  };

  async handler(args: { adapterName: string }, toolCtx?: ToolExecutionContext) {
    const { settings, taskService } = requireToolContext(toolCtx, this.id);
    try {
      const adapter = (settings.ADAPTERS || []).find(
        (a) => a.name === args.adapterName || a.id === args.adapterName,
      );
      if (!adapter) {
        return {
          ok: false,
          errorCode: 'NOT_FOUND',
          message: `适配器 ${args.adapterName} 不存在`,
          hint: '调 list_adapters 查看可用适配器',
        };
      }
      const statusMap = await taskService.getAdapterStatus();
      const statusInfo = resolveAdapterStatus(statusMap, adapter.name);
      return {
        ok: true,
        name: adapter.name,
        config: adapter,
        status: statusInfo?.status,
        lastRun: statusInfo?.lastRun ?? statusInfo?.lastActive,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errorCode: 'GET_ADAPTER_CONFIG_FAILED', message };
    }
  }
}

class SyncAdapterTool extends BaseTool {
  readonly id = 'sync_adapter';
  readonly name = 'sync_adapter';
  readonly displayName = '同步适配器';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '手动触发单个采集适配器的数据同步。必填 adapterName;可选 date(YYYY-MM-DD,默认今日)。' +
    '执行前应先调 get_adapter_config 或 list_adapters 让用户确认适配器。';
  readonly parameters = {
    type: 'object',
    properties: {
      adapterName: { type: 'string', description: '适配器名称' },
      date: { type: 'string', description: '采集日期 YYYY-MM-DD(可选)' },
    },
    required: ['adapterName'],
  };

  async handler(args: { adapterName: string; date?: string }, toolCtx?: ToolExecutionContext) {
    const { taskService } = requireToolContext(toolCtx, this.id);
    try {
      await taskService.runSingleAdapterIngestion(args.adapterName, args.date, {});
      return { ok: true, adapterName: args.adapterName, message: '同步已触发' };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'SYNC_ADAPTER_FAILED',
        message,
        hint: '可在 /scheduling 页面查看同步进度',
      };
    }
  }
}

class ClearAdapterDataTool extends BaseTool {
  readonly id = 'clear_adapter_data';
  readonly name = 'clear_adapter_data';
  readonly displayName = '清理适配器数据';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '清理单个采集适配器已抓取的数据(高危,不可撤销)。必填 adapterName;可选 date(YYYY-MM-DD)。' +
    '执行前应先调 get_adapter_config 让用户确认。';
  readonly parameters = {
    type: 'object',
    properties: {
      adapterName: { type: 'string', description: '适配器名称' },
      date: { type: 'string', description: '清理指定日期数据 YYYY-MM-DD(可选)' },
    },
    required: ['adapterName'],
  };

  async handler(args: { adapterName: string; date?: string }, toolCtx?: ToolExecutionContext) {
    const { taskService } = requireToolContext(toolCtx, this.id);
    try {
      await taskService.clearAdapterData(args.adapterName, args.date);
      return { ok: true, adapterName: args.adapterName };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'CLEAR_ADAPTER_DATA_FAILED',
        message,
        hint: '确认 adapterName 正确且该适配器存在已抓取数据',
      };
    }
  }
}

export const schedulingTools: BaseTool[] = [
  new ListTaskLogsTool(),
  new GetScheduleDetailTool(),
  new GetAdapterConfigTool(),
  new SyncAdapterTool(),
  new ClearAdapterDataTool(),
];
