import { describe, expect, it } from 'vitest';

import { mapCategoriesAndDocumentsToTree } from './kbDocuments';
import { mapWorkspaceSkillCatalog, type BackendToolDto } from './skillCatalog';

describe('mapWorkspaceSkillCatalog', () => {
  it('maps skills, tools, agents, and builtin commands', () => {
    const catalog = mapWorkspaceSkillCatalog({
      skills: [
        {
          id: 'memory-write',
          name: 'prismflow-memory-write',
          description: 'Auto save memory',
          files: ['SKILL.md'],
        },
      ],
      tools: [
        {
          id: 'batch_agent_runner',
          displayName: '分批执行',
          description: 'Run agent batches',
        },
      ],
      mcpConfigs: [{ id: 'mcp-1', name: 'Filesystem', description: 'Local FS' }],
      agents: [
        {
          id: 'copilot',
          name: 'Copilot',
          description: 'helper',
          gradient: 'linear-gradient(#000,#111)',
          welcome: '',
          openingQuestions: [],
        },
      ],
    });

    expect(catalog.commands).toHaveLength(2);
    expect(catalog.agentSkills[0].files).toEqual(['SKILL.md']);
    expect(catalog.projectSkills[0].id).toBe('memory-write');
    expect(catalog.tools.map((t) => t.id)).toEqual(['batch_agent_runner', 'mcp:mcp-1']);
    expect(catalog.agents[0].name).toBe('Copilot');
    expect(catalog.userSkills).toEqual([]);
  });

  it('dedupes mcp config when plugin id already exists', () => {
    const catalog = mapWorkspaceSkillCatalog({
      skills: [],
      tools: [{ id: 'mcp:mcp-1', name: 'existing' }],
      mcpConfigs: [{ id: 'mcp-1', name: 'dup' }],
      agents: [],
    });
    expect(catalog.tools).toHaveLength(1);
  });

  it('skips tools without id', () => {
    const catalog = mapWorkspaceSkillCatalog({
      skills: [],
      tools: [{ name: 'orphan-tool' } as BackendToolDto, { id: 'valid_tool', name: 'Valid' }],
      mcpConfigs: [],
      agents: [],
    });
    expect(catalog.tools.map((t) => t.id)).toEqual(['valid_tool']);
  });
});

describe('mapCategoriesAndDocumentsToTree', () => {
  it('builds category folders with document children', () => {
    const tree = mapCategoriesAndDocumentsToTree([
      {
        category: { id: 'cat-1', name: 'AI资讯日报' },
        documents: [
          {
            id: 'doc-1',
            categoryId: 'cat-1',
            name: '2026-05-28.md',
            fileName: '2026-05-28.md',
            type: 'md',
          },
        ],
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('AI资讯日报');
    expect(tree[0].badge).toBe('1');
    expect(tree[0].children?.[0].path).toBe('AI资讯日报/2026-05-28.md');
  });

  it('skips empty categories', () => {
    expect(
      mapCategoriesAndDocumentsToTree([
        { category: { id: 'empty', name: 'Empty' }, documents: [] },
      ]),
    ).toEqual([]);
  });
});
