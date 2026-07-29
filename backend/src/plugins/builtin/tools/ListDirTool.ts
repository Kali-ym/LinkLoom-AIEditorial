import type { ToolExecutionPolicy } from '../../../types/agent.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { listWorkspaceDir } from './workspaceFileToolSupport.js';

export class ListDirTool extends BaseTool {
  readonly id = 'list_dir';
  readonly name = 'list_dir';
  readonly displayName = '列出目录';
  readonly scope = 'agent' as const;
  readonly description =
    '列出工作区目录下的文件与子目录。浏览项目结构时优先使用本工具，不要用 execute_command。' +
    '可选：path（默认 .）、recursive（默认 false）。';
  readonly parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Workspace-relative directory path (default .)' },
      recursive: { type: 'boolean', description: 'Recurse into subdirectories (default false)' },
    },
  };
  readonly execution: ToolExecutionPolicy = {
    readonly: true,
    riskLevel: 'low',
    capabilities: ['filesystem.read'],
  };

  async handler(
    args: { path?: string; recursive?: boolean },
    context?: ToolExecutionContext
  ) {
    return listWorkspaceDir(
      typeof args.path === 'string' ? args.path : '.',
      Boolean(args.recursive),
      context
    );
  }
}
