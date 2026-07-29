import type { ToolExecutionPolicy } from '../../../types/agent.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { globWorkspaceFiles } from './workspaceFileToolSupport.js';

export class GlobTool extends BaseTool {
  readonly id = 'glob';
  readonly name = 'glob';
  readonly displayName = '文件匹配';
  readonly scope = 'agent' as const;
  readonly description =
    '按 glob 模式在工作区中匹配文件路径（如 **/*.ts、src/**/*.md）。查找文件时优先使用，不要用 execute_command。' +
    '必填：pattern；可选 cwd（默认 .）、limit（默认 200）。';
  readonly parameters = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern, e.g. **/*.md' },
      cwd: { type: 'string', description: 'Search root relative to workspace (default .)' },
      limit: { type: 'number', description: 'Max matches to return (default 200)' },
    },
    required: ['pattern'],
  };
  readonly execution: ToolExecutionPolicy = {
    readonly: true,
    riskLevel: 'low',
    capabilities: ['filesystem.read'],
  };

  async handler(
    args: { pattern?: string; cwd?: string; limit?: number },
    context?: ToolExecutionContext
  ) {
    const limit =
      typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit > 0
        ? Math.floor(args.limit)
        : 200;
    return globWorkspaceFiles(
      String(args.pattern || ''),
      typeof args.cwd === 'string' ? args.cwd : '.',
      limit,
      context
    );
  }
}
