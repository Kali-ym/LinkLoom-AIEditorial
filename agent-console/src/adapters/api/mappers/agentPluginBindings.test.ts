import { describe, expect, it } from 'vitest';

import type { SkillCatalog } from '../../../domain/types/skill';
import {
  deriveAgentBindingIds,
  filterBindingsByPlugins,
  parseMcpPluginId,
  toMcpPluginId,
} from './agentPluginBindings';
import { applyConfigPatchToBackendAgent } from './agent';
import type { BackendAgentDto } from '../types/agent';

const catalog: SkillCatalog = {
  commands: [],
  agentSkills: [{ id: 'read_skill_pkg', name: 'Read Skill', description: '' }],
  projectSkills: [],
  userSkills: [],
  tools: [
    { id: 'query_knowledge', name: 'Knowledge', description: '' },
    { id: toMcpPluginId('github-mcp'), name: 'GitHub MCP', description: '' },
  ],
  agents: [],
};

describe('agentPluginBindings', () => {
  it('maps plugin toggles to toolIds, skillIds, and mcpServerIds', () => {
    expect(
      deriveAgentBindingIds(
        {
          query_knowledge: true,
          read_skill_pkg: true,
          [toMcpPluginId('github-mcp')]: true,
          web_search: true,
          disabled_tool: false,
        },
        catalog,
      ),
    ).toEqual({
      toolIds: ['query_knowledge', 'web_search'],
      skillIds: ['read_skill_pkg'],
      mcpServerIds: ['github-mcp'],
    });
  });

  it('parses mcp plugin ids', () => {
    expect(toMcpPluginId('srv-1')).toBe('mcp:srv-1');
    expect(parseMcpPluginId('mcp:srv-1')).toBe('srv-1');
    expect(parseMcpPluginId('query_knowledge')).toBeNull();
  });

  it('filters catalog rows by enabled plugin toggles', () => {
    expect(
      filterBindingsByPlugins(
        [
          { id: 'daily-one-x', name: 'Daily' },
          { id: 'memory-read', name: 'Memory' },
        ],
        { 'daily-one-x': true, 'memory-read': false },
      ).map((item) => item.id),
    ).toEqual(['daily-one-x']);
  });
});

describe('applyConfigPatchToBackendAgent bindings', () => {
  const base: BackendAgentDto = {
    id: 'agent-1',
    name: 'Agent',
    description: '',
    systemPrompt: '',
    providerId: 'default',
    model: 'gpt',
    temperature: 0.2,
    toolIds: [],
    skillIds: [],
    mcpServerIds: [],
    streaming: true,
    runtime: { mode: 'react', maxRounds: 3 },
    knowledgeCategoryIds: [],
    knowledgeSaveCategoryIds: [],
    memoryCategoryIds: [],
    memorySaveCategoryIds: [],
  };

  it('persists toolIds, skillIds, and mcpServerIds from patch', () => {
    const patched = applyConfigPatchToBackendAgent(base, {
      toolIds: ['web_search'],
      skillIds: ['read_skill_pkg'],
      mcpServerIds: ['github-mcp'],
    });

    expect(patched.toolIds).toEqual(['web_search']);
    expect(patched.skillIds).toEqual(['read_skill_pkg']);
    expect(patched.mcpServerIds).toEqual(['github-mcp']);
  });
});
