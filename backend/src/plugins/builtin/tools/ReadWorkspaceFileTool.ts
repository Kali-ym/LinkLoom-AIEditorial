import type { ToolExecutionPolicy } from '../../../types/agent.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import {
  DEFAULT_WORKSPACE_FILE_MAX_BYTES,
  readWorkspaceFile
} from './workspaceFileToolSupport.js';

export class ReadWorkspaceFileTool extends BaseTool {
  readonly id = 'read_workspace_file';
  readonly name = 'readFile';
  readonly displayName = '读取工作区文件';
  readonly scope = 'agent' as const;
  readonly description =
    '读取当前活跃工作区中的 UTF-8 或二进制文件；沙箱模式读取容器 /workspace 下路径。查看代码、配置或产出文件时调用。' +
    '必填：path（工作区相对路径或 /workspace 绝对路径）；可选 maxBytes。工具调用名：readFile。';
  readonly parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Workspace-relative or absolute /workspace path' },
      maxBytes: {
        type: 'number',
        description: `Maximum bytes to read (default ${DEFAULT_WORKSPACE_FILE_MAX_BYTES})`
      }
    },
    required: ['path']
  };
  readonly execution: ToolExecutionPolicy = {
    readonly: true,
    riskLevel: 'low',
    capabilities: ['filesystem.read']
  };

  async handler(
    args: { path?: string; maxBytes?: number },
    context?: ToolExecutionContext
  ) {
    const filePath = typeof args.path === 'string' ? args.path.trim() : '';
    if (!filePath) {
      throw new Error('path is required');
    }
    const maxBytes =
      typeof args.maxBytes === 'number' && Number.isFinite(args.maxBytes) && args.maxBytes > 0
        ? Math.floor(args.maxBytes)
        : DEFAULT_WORKSPACE_FILE_MAX_BYTES;
    return readWorkspaceFile(filePath, maxBytes, context);
  }
}
