import type { ToolExecutionPolicy } from '../../../types/agent.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';
import {
  DEFAULT_WORKSPACE_FILE_EDIT_MAX_BYTES,
  editWorkspaceFile,
  readWorkspaceFile,
} from './workspaceFileToolSupport.js';
import { syncLinkloomArtifactToSession } from './linkloomWorkspaceSync.js';
import {
  isLinkloomPlanPath,
  isLinkloomTodosPath,
} from './linkloomWorkspaceArtifacts.js';

export class EditWorkspaceFileTool extends BaseTool {
  readonly id = 'edit_workspace_file';
  readonly name = 'editFile';
  readonly displayName = '编辑工作区文件';
  readonly scope = 'agent' as const;
  readonly description =
    '对活跃工作区中的 UTF-8 文本文件执行精确查找替换补丁。修改已有文件部分内容时调用，整文件覆盖请用 writeFile。' +
    '编辑 `.linkloom/plan.md` / `.linkloom/todos.json` 会同步会话计划与待办 UI。' +
    '必填：path、search、replace；可选 all=true。工具调用名：editFile。';
  readonly parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Workspace-relative or absolute /workspace path' },
      search: { type: 'string', description: 'Exact text to find in the file' },
      replace: { type: 'string', description: 'Replacement text' },
      all: {
        type: 'boolean',
        description: 'Replace all occurrences when true; otherwise only the first match'
      }
    },
    required: ['path', 'search', 'replace']
  };
  readonly execution: ToolExecutionPolicy = {
    readonly: false,
    riskLevel: 'medium',
    capabilities: ['filesystem.read', 'filesystem.write']
  };

  async handler(
    args: { path?: string; search?: string; replace?: string; all?: boolean },
    context?: ToolExecutionContext
  ) {
    const filePath = typeof args.path === 'string' ? args.path.trim() : '';
    if (!filePath) {
      throw new Error('path is required');
    }
    if (typeof args.search !== 'string') {
      throw new Error('search is required');
    }
    if (typeof args.replace !== 'string') {
      throw new Error('replace is required');
    }
    const result = await editWorkspaceFile(
      filePath,
      args.search,
      args.replace,
      args.all === true,
      context
    );
    if (isLinkloomPlanPath(filePath) || isLinkloomTodosPath(filePath)) {
      const read = await readWorkspaceFile(
        filePath,
        DEFAULT_WORKSPACE_FILE_EDIT_MAX_BYTES,
        context
      );
      if (read.encoding === 'utf8' && !read.truncated) {
        await syncLinkloomArtifactToSession(filePath, read.content, context);
      }
    }
    return result;
  }
}
