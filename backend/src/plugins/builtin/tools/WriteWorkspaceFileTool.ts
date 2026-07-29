import type { ToolExecutionPolicy } from '../../../types/agent.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import { writeWorkspaceFile } from './workspaceFileToolSupport.js';
import { syncLinkloomArtifactToSession } from './linkloomWorkspaceSync.js';

export class WriteWorkspaceFileTool extends BaseTool {
  readonly id = 'write_workspace_file';
  readonly name = 'writeFile';
  readonly displayName = '写入工作区文件';
  readonly scope = 'agent' as const;
  readonly description =
    '将 UTF-8 文本写入活跃工作区文件（新建或整文件覆盖）；沙箱模式写入 /workspace。创建新文件或全量覆写时调用，局部修改请用 editFile。' +
    '多步任务请写 `.linkloom/plan.md`（计划）与 `.linkloom/todos.json`（待办 JSON 数组）。' +
    '必填：path、content。工具调用名：writeFile。';
  readonly parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Workspace-relative or absolute /workspace path' },
      content: { type: 'string', description: 'UTF-8 text content to write' }
    },
    required: ['path', 'content']
  };
  readonly execution: ToolExecutionPolicy = {
    readonly: false,
    riskLevel: 'medium',
    capabilities: ['filesystem.write']
  };

  async handler(
    args: { path?: string; content?: string },
    context?: ToolExecutionContext
  ) {
    const filePath = typeof args.path === 'string' ? args.path.trim() : '';
    if (!filePath) {
      throw new Error('path is required');
    }
    if (typeof args.content !== 'string') {
      throw new Error('content is required');
    }
    const result = await writeWorkspaceFile(filePath, args.content, context);
    await syncLinkloomArtifactToSession(filePath, args.content, context);
    return result;
  }
}
