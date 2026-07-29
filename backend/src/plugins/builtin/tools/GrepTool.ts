import type { ToolExecutionPolicy } from '../../../types/agent.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { grepWorkspaceFiles } from './workspaceFileToolSupport.js';

export class GrepTool extends BaseTool {
  readonly id = 'grep';
  readonly name = 'grep';
  readonly displayName = '内容搜索';
  readonly scope = 'agent' as const;
  readonly description =
    '在工作区文本文件中用正则搜索内容，返回匹配行。搜索代码/配置内容时优先使用，不要用 execute_command。' +
    '必填：pattern；可选 path、glob、caseInsensitive、limit（默认 100）。';
  readonly parameters = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'JavaScript regex pattern' },
      path: { type: 'string', description: 'File or directory to search (default .)' },
      glob: { type: 'string', description: 'Optional file glob filter, e.g. **/*.{ts,md}' },
      caseInsensitive: { type: 'boolean', description: 'Case-insensitive match (default false)' },
      limit: { type: 'number', description: 'Max matches (default 100)' },
    },
    required: ['pattern'],
  };
  readonly execution: ToolExecutionPolicy = {
    readonly: true,
    riskLevel: 'low',
    capabilities: ['filesystem.read'],
  };

  async handler(
    args: {
      pattern?: string;
      path?: string;
      glob?: string;
      caseInsensitive?: boolean;
      limit?: number;
    },
    context?: ToolExecutionContext
  ) {
    return grepWorkspaceFiles(
      String(args.pattern || ''),
      {
        path: args.path,
        glob: args.glob,
        caseInsensitive: Boolean(args.caseInsensitive),
        limit: args.limit,
      },
      context
    );
  }
}
