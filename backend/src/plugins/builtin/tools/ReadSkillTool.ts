import { AppError } from '../../../domain/errors.js';
import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';

type ReadSkillArgs = {
  skillId?: unknown;
  id?: unknown;
  path?: unknown;
  file_path?: unknown;
  filePath?: unknown;
};

function resolveSkillId(args: ReadSkillArgs): string {
  for (const key of ['skillId', 'id'] as const) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function resolveRelativePath(args: ReadSkillArgs): string | undefined {
  for (const key of ['path', 'file_path', 'filePath'] as const) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return value.trim().replace(/\\/g, '/');
  }
  return undefined;
}

export class ReadSkillTool extends BaseTool {
  readonly id = 'read_skill';
  readonly name = 'read_skill';
  readonly displayName = '读取技能';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '读取指定 Skill 的 SKILL.md 指令或技能目录内的参考文件。执行某技能前获取其完整操作指南时调用，可先 list_skill 查找。' +
    '必填：skillId（或 id 别名）；省略 path 时返回 SKILL.md，传 path 时读取子文件（如 references/guide.md）。';
  readonly parameters = {
    type: 'object',
    properties: {
      skillId: {
        type: 'string',
        description: 'Skill id (directory name under skills/)',
      },
      id: {
        type: 'string',
        description: 'Alias of skillId',
      },
      path: {
        type: 'string',
        description: 'Optional relative file path within the skill directory (e.g. references/guide.md)',
      },
      file_path: {
        type: 'string',
        description: 'Alias of path',
      },
    },
    required: ['skillId'],
  };

  async handler(args: ReadSkillArgs, toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(toolCtx, this.id);
    const skillId = resolveSkillId(args);
    if (!skillId) {
      throw new AppError(400, 'skillId is required');
    }

    const allowed = context.exposedSkillIds;
    if (allowed && !allowed.includes(skillId)) {
      throw new AppError(403, `Skill not exposed for this agent: ${skillId}`);
    }

    const relativePath = resolveRelativePath(args) ?? 'SKILL.md';
    return context.services.skillService.readSkillContent(skillId, relativePath);
  }
}
