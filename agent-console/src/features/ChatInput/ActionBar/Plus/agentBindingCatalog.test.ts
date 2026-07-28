import { describe, expect, it } from 'vitest';

import type { SkillCatalog } from '../../../../domain/types/skill';
import {
  buildAgentBindingRows,
  classifyBindingKind,
  groupAgentBindingRows,
  isAgentCallableToolScope,
} from './agentBindingCatalog';

const catalog: SkillCatalog = {
  commands: [],
  agentSkills: [{ id: 'skill-a', name: 'Skill A', description: 'a' }],
  projectSkills: [{ id: 'proj-only', name: 'Proj', description: 'p' }],
  userSkills: [{ id: 'user-only', name: 'User', description: 'u', source: 'user' }],
  tools: [
    { id: 'query_data', name: 'Query Data', description: 'd', scope: 'both' },
    { id: 'fetch_data', name: 'Fetch', description: 'w', scope: 'workflow' },
    { id: 'mcp:linear', name: 'Linear', description: 'mcp' },
  ],
  agents: [],
};

describe('agentBindingCatalog', () => {
  it('lists all catalog tools and agent skills', () => {
    const rows = buildAgentBindingRows(catalog, {});
    const { tools, skills, mcp } = groupAgentBindingRows(rows);
    // tools is now ToolGroup[]; flatten to check ids
    expect(tools.flatMap((g) => g.items.map((r) => r.id))).toEqual(['fetch_data', 'query_data']);
    expect(skills.map((row) => row.id)).toEqual(['skill-a']);
    expect(mcp.map((row) => row.id)).toEqual(['mcp:linear']);
  });

  it('classifies binding kinds', () => {
    expect(classifyBindingKind('mcp:linear', catalog)).toBe('mcp');
    expect(classifyBindingKind('skill-a', catalog)).toBe('skill');
    expect(classifyBindingKind('query_data', catalog)).toBe('tool');
  });

  it('accepts agent and both scopes', () => {
    expect(isAgentCallableToolScope('agent')).toBe(true);
    expect(isAgentCallableToolScope('both')).toBe(true);
    expect(isAgentCallableToolScope('workflow')).toBe(false);
  });

  it('skips catalog entries without id', () => {
    const broken: SkillCatalog = {
      ...catalog,
      agentSkills: [{ id: '', name: 'Broken skill', description: 'x' }],
      tools: [
        { id: '', name: 'Broken tool', description: 'x' },
        { id: 'query_data', name: 'Query Data', description: 'd', scope: 'both' },
      ],
    };
    const rows = buildAgentBindingRows(broken, {});
    expect(rows.map((row) => row.id)).toEqual(['query_data']);
  });
});
