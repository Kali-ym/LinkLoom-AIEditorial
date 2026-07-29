import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { BaseTool } from '../../../base/BaseTool.js';
import { discoverPlatformOperations } from './platformApiCatalog.js';

export class PlatformDiscoverTool extends BaseTool {
  readonly id = 'platform_discover';
  readonly name = 'platform_discover';
  readonly displayName = '发现平台 API';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution: ToolExecutionPolicy = {
    readonly: true,
    riskLevel: 'low',
  };
  readonly description =
    '发现 allowlist 内的平台管理 API。不确定 path/参数时先调本工具再 platform_invoke。' +
    '默认返回精简索引；匹配 ≤8 条或 detail=true 时展开底层工具 description 与 args。' +
    '建议先用具体 prefix（如 /api/feed）或 q（如 scored）收窄。' +
    '可选：prefix、method、q、detail、limit。';
  readonly parameters = {
    type: 'object',
    properties: {
      prefix: {
        type: 'string',
        description: 'Path prefix filter, e.g. /api/feed or /api/schedules',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
        description: 'Filter by HTTP method',
      },
      q: {
        type: 'string',
        description: 'Keyword match on path / summary / toolId, e.g. scored or cron',
      },
      detail: {
        type: 'boolean',
        description: 'Force include tool description + args (auto when ≤8 matches)',
      },
      limit: { type: 'number', description: 'Max operations to return (default 50)' },
    },
  };

  async handler(
    args: {
      prefix?: string;
      method?: string;
      q?: string;
      detail?: boolean;
      limit?: number;
    },
    toolCtx?: ToolExecutionContext
  ) {
    requireToolContext(toolCtx, this.id);
    return discoverPlatformOperations({
      prefix: args.prefix,
      method: args.method,
      q: args.q,
      detail: args.detail,
      limit: args.limit,
    });
  }
}
