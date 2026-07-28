import { describe, expect, it, vi, beforeEach } from 'vitest';
import { agentTools } from '../src/plugins/builtin/tools/admin/agentTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const {
  mockListVisibleAgents,
  mockGetAgent,
  mockListSkills,
  mockScanSkills,
  mockListAvailableTools,
  mockListConfigs,
  mockTestConnection,
  mockListTemplates,
  mockListBindings,
} = vi.hoisted(() => ({
  mockListVisibleAgents: vi.fn(),
  mockGetAgent: vi.fn(),
  mockListSkills: vi.fn(),
  mockScanSkills: vi.fn(),
  mockListAvailableTools: vi.fn(),
  mockListConfigs: vi.fn(),
  mockTestConnection: vi.fn(),
  mockListTemplates: vi.fn(),
  mockListBindings: vi.fn(),
}));

vi.mock('../src/services/api/AgentRunService.js', () => ({
  AgentRunService: class MockAgentRunService {
    listVisibleAgents = mockListVisibleAgents;
    getAgent = mockGetAgent;
  },
}));

vi.mock('../src/services/api/SkillCatalogService.js', () => ({
  SkillCatalogService: class MockSkillCatalogService {
    listSkills = mockListSkills;
    scanSkills = mockScanSkills;
  },
}));

vi.mock('../src/services/api/ToolRouteService.js', () => ({
  ToolRouteService: class MockToolRouteService {
    listAvailableTools = mockListAvailableTools;
  },
}));

vi.mock('../src/services/api/McpRouteService.js', () => ({
  McpRouteService: class MockMcpRouteService {
    listConfigs = mockListConfigs;
    testConnection = mockTestConnection;
  },
}));

vi.mock('../src/services/api/WorkflowTemplateRouteService.js', () => ({
  WorkflowTemplateRouteService: class MockWorkflowTemplateRouteService {
    listTemplates = mockListTemplates;
  },
}));

vi.mock('../src/services/agents/AgentBindingService.js', () => ({
  AgentBindingService: vi.fn().mockImplementation(function () {
    return { listBindings: mockListBindings };
  }),
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {}, settings: {} } as unknown as ToolExecutionContext;
}

describe('admin agent tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListVisibleAgents.mockResolvedValue([
      { id: 'a1', name: 'Agent 1', description: 'desc', category: 'editorial', toolIds: ['t1', 't2'] },
    ]);
    mockGetAgent.mockResolvedValue({ id: 'a1', name: 'Agent 1', toolIds: ['t1'] });
    mockListSkills.mockResolvedValue([{ id: 's1', name: 'Skill 1' }]);
    mockScanSkills.mockResolvedValue({ status: 'success', added: 1, updated: 0 });
    mockListAvailableTools.mockReturnValue([
      { id: 'tool1', name: 'tool1', description: 'A tool' },
    ]);
    mockListConfigs.mockResolvedValue([{ id: 'mcp1', name: 'MCP 1' }]);
    mockTestConnection.mockResolvedValue({ healthy: true });
    mockListTemplates.mockResolvedValue([
      { id: 'tpl1', name: 'Template 1', agentCount: 2, workflowCount: 1 },
    ]);
    mockListBindings.mockResolvedValue({ bindings: [{ id: 'b1', resourceType: 'kb_category' }] });
  });

  it('list_agents maps agents with toolCount', async () => {
    const t = agentTools.find((x) => x.id === 'list_agents')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.items[0]).toMatchObject({
      id: 'a1',
      name: 'Agent 1',
      category: 'editorial',
      toolCount: 2,
    });
  });

  it('get_agent returns agent', async () => {
    const t = agentTools.find((x) => x.id === 'get_agent')!;
    const r = await t.handler({ agentId: 'a1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.agent.id).toBe('a1');
  });

  it('get_agent returns NOT_FOUND on missing agent', async () => {
    mockGetAgent.mockRejectedValue(new Error('Agent x not found'));
    const t = agentTools.find((x) => x.id === 'get_agent')!;
    const r = await t.handler({ agentId: 'x' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('list_skills returns skills', async () => {
    const t = agentTools.find((x) => x.id === 'list_skills')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.skills[0].id).toBe('s1');
  });

  it('scan_skills returns scan result', async () => {
    const t = agentTools.find((x) => x.id === 'scan_skills')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.added).toBe(1);
  });

  it('list_tools maps id/name/description', async () => {
    const t = agentTools.find((x) => x.id === 'list_tools')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.items[0]).toEqual({ id: 'tool1', name: 'tool1', description: 'A tool' });
  });

  it('list_mcp_configs returns configs', async () => {
    const t = agentTools.find((x) => x.id === 'list_mcp_configs')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.configs[0].id).toBe('mcp1');
  });

  it('test_mcp returns connection result', async () => {
    const t = agentTools.find((x) => x.id === 'test_mcp')!;
    const r = await t.handler({ mcpId: 'mcp1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.mcpId).toBe('mcp1');
    expect(r.result).toMatchObject({ healthy: true });
    expect(mockTestConnection).toHaveBeenCalledWith('mcp1');
  });

  it('list_workflow_templates returns templates', async () => {
    const t = agentTools.find((x) => x.id === 'list_workflow_templates')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.templates[0].id).toBe('tpl1');
  });

  it('list_agent_bindings returns bindings', async () => {
    const t = agentTools.find((x) => x.id === 'list_agent_bindings')!;
    const r = await t.handler({ agentId: 'a1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.bindings).toHaveLength(1);
  });

  it('list_agent_bindings handles PgConnection unavailable', async () => {
    const { AgentBindingService } = await import('../src/services/agents/AgentBindingService.js');
    vi.mocked(AgentBindingService).mockImplementationOnce(() => {
      throw new Error('PgConnection not available for AgentBindingService');
    });
    const t = agentTools.find((x) => x.id === 'list_agent_bindings')!;
    const r = await t.handler({ agentId: 'a1' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('PG_UNAVAILABLE');
    expect(r.hint).toContain('PostgreSQL');
  });

  it('does not include get_workflow_run (lives in opsTools)', () => {
    expect(agentTools.find((x) => x.id === 'get_workflow_run')).toBeUndefined();
  });

  it('read-only agent tools have no execution policy', () => {
    const readOnlyIds = [
      'list_agents',
      'get_agent',
      'list_skills',
      'scan_skills',
      'list_tools',
      'list_mcp_configs',
      'test_mcp',
      'list_workflow_templates',
      'list_agent_bindings',
    ];
    for (const id of readOnlyIds) {
      const t = agentTools.find((x) => x.id === id)!;
      expect((t as { execution?: unknown }).execution).toBeUndefined();
    }
  });

  it('has exactly 13 tools', () => {
    expect(agentTools).toHaveLength(13);
  });
});
