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
    '发现 allowlist 内的平台管理 API（method+path+简述）。在调用 platform_invoke 前不确定路径时使用。' +
    '可选：prefix（默认 /api）、limit（默认 50）。';
  readonly parameters = {
    type: 'object',
    properties: {
      prefix: { type: 'string', description: 'Path prefix filter, e.g. /api/schedules' },
      limit: { type: 'number', description: 'Max operations to return (default 50)' },
    },
  };

  async handler(
    args: { prefix?: string; limit?: number },
    toolCtx?: ToolExecutionContext
  ) {
    requireToolContext(toolCtx, this.id);
    const limit =
      typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit > 0
        ? Math.floor(args.limit)
        : 50;
    return discoverPlatformOperations(args.prefix, limit);
  }
}
