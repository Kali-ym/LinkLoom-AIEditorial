import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { BaseTool } from '../../../base/BaseTool.js';
import { invokePlatformOperation } from './platformApiCatalog.js';

export class PlatformInvokeTool extends BaseTool {
  readonly id = 'platform_invoke';
  readonly name = 'platform_invoke';
  readonly displayName = '调用平台 API';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution: ToolExecutionPolicy = {
    readonly: false,
    riskLevel: 'medium',
  };
  readonly description =
    '在 allowlist 内以 REST 风格调用平台管理 API（内部调度，不出站）。' +
    '读操作用 GET 自主调用；写操作(POST/PATCH/PUT/DELETE)需 HITL 确认。' +
    '高频 SOP 优先用专属工具(create_cron/trigger_scoring/generate_daily_report/…)。' +
    '不确定 path 时先调 platform_discover。必填：method、path；可选 query、body、purpose。';
  readonly parameters = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
        description: 'HTTP method',
      },
      path: {
        type: 'string',
        description: 'Allowlisted path, e.g. /api/schedules or /api/agents/:id',
      },
      query: {
        type: 'object',
        additionalProperties: true,
        description: 'Query parameters',
      },
      body: {
        type: 'object',
        additionalProperties: true,
        description: 'JSON body for write methods',
      },
      purpose: {
        type: 'string',
        description: 'One-line intent shown to the user',
      },
    },
    required: ['method', 'path'],
  };

  async handler(
    args: {
      method: string;
      path: string;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
      purpose?: string;
    },
    toolCtx?: ToolExecutionContext
  ) {
    const context = requireToolContext(toolCtx, this.id);
    return invokePlatformOperation(args, context);
  }
}
