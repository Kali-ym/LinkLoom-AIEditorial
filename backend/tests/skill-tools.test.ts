import { describe, expect, it } from 'vitest';

import { AppError } from '../src/domain/errors.js';
import { ListSkillTool } from '../src/plugins/builtin/tools/ListSkillTool.js';
import { ReadSkillTool } from '../src/plugins/builtin/tools/ReadSkillTool.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';
import type { SkillEntry } from '../src/types/skill.js';

const sampleSkills: SkillEntry[] = [
  {
    id: 'memory-read',
    name: 'Memory Read',
    description: 'Read user memory snippets',
    instructions: 'Use memory read workflow.',
    files: ['references/guide.md'],
    frontmatter: { name: 'Memory Read', description: 'Read user memory snippets' },
    dirPath: '/tmp/skills/memory-read',
    fullPath: '/tmp/skills/memory-read/SKILL.md',
    isBuiltin: true,
  },
  {
    id: 'daily-one-x',
    name: 'Daily One X',
    description: 'Daily editorial workflow',
    instructions: 'Follow the daily checklist.',
    files: [],
    frontmatter: { name: 'Daily One X', description: 'Daily editorial workflow' },
    dirPath: '/tmp/skills/daily-one-x',
    fullPath: '/tmp/skills/daily-one-x/SKILL.md',
    isBuiltin: true,
  },
];

function createCtx(skills: SkillEntry[] = sampleSkills): ToolExecutionContext {
  return {
    store: {} as ToolExecutionContext['store'],
    settings: {} as ToolExecutionContext['settings'],
    taskService: {} as ToolExecutionContext['taskService'],
    agentService: null,
    logger: console as unknown as ToolExecutionContext['logger'],
    auditLogger: {} as ToolExecutionContext['auditLogger'],
    services: {
      skillService: {
        listSkills: () => skills,
        listSkillMetadata: (ids?: string[]) =>
          skills
            .filter((skill) => !ids || ids.includes(skill.id))
            .map(({ id, name, description }) => ({ id, name, description })),
        getSkill: (id: string) => skills.find((skill) => skill.id === id),
        readSkillContent: async (id: string, relativePath = 'SKILL.md') => {
          const skill = skills.find((item) => item.id === id);
          if (!skill) throw new AppError(404, `Skill not found: ${id}`);
          return {
            skillId: skill.id,
            name: skill.name,
            description: skill.description,
            path: relativePath,
            content: relativePath === 'SKILL.md' ? skill.instructions : 'reference content',
            files: skill.files,
          };
        },
      },
    } as ToolExecutionContext['services'],
  };
}

describe('ListSkillTool', () => {
  it('lists skills and filters by query', async () => {
    const tool = new ListSkillTool();
    const all = await tool.handler({}, createCtx());
    expect(all.count).toBe(2);
    expect(all.results?.map((item) => item.id)).toEqual(['memory-read', 'daily-one-x']);

    const filtered = await tool.handler({ query: 'memory' }, createCtx());
    expect(filtered.count).toBe(1);
    expect(filtered.results?.[0]).toMatchObject({
      id: 'memory-read',
      title: 'Memory Read',
    });
  });

  it('filters skills by exposedSkillIds on the tool context', async () => {
    const tool = new ListSkillTool();
    const ctx = createCtx();
    ctx.exposedSkillIds = ['daily-one-x'];

    const result = await tool.handler({}, ctx);
    expect(result.count).toBe(1);
    expect(result.results?.[0]?.id).toBe('daily-one-x');
  });

  it('does not expose instructions through list_skill', async () => {
    const result = await new ListSkillTool().handler({}, createCtx());
    expect(JSON.stringify(result)).not.toContain('Use memory read workflow.');
    expect(result.results?.[0]).not.toHaveProperty('files');
  });
});

describe('ReadSkillTool', () => {
  it('returns parsed instructions when path is omitted', async () => {
    const tool = new ReadSkillTool();
    const result = await tool.handler({ skillId: 'memory-read' }, createCtx());

    expect(result).toMatchObject({
      skillId: 'memory-read',
      path: 'SKILL.md',
      content: 'Use memory read workflow.',
      files: ['references/guide.md'],
    });
  });

  it('rejects unknown skill ids', async () => {
    const tool = new ReadSkillTool();
    await expect(tool.handler({ skillId: 'missing' }, createCtx())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects skills outside exposedSkillIds', async () => {
    const tool = new ReadSkillTool();
    const ctx = createCtx();
    ctx.exposedSkillIds = ['daily-one-x'];

    await expect(tool.handler({ skillId: 'memory-read' }, ctx)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
