import { describe, expect, it, vi, beforeEach } from 'vitest';
import { agentTools } from '../src/plugins/builtin/tools/admin/agentTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const {
  mockSaveAgent,
  mockDeleteAgent,
  mockSaveWorkflow,
  mockInstantiate,
} = vi.hoisted(() => ({
  mockSaveAgent: vi.fn(),
  mockDeleteAgent: vi.fn(),
  mockSaveWorkflow: vi.fn(),
  mockInstantiate: vi.fn(),
}));

vi.mock('../src/services/api/AgentRunService.js', () => ({
  AgentRunService: class MockAgentRunService {
    saveAgent = mockSaveAgent;
    deleteAgent = mockDeleteAgent;
  },
}));

vi.mock('../src/services/api/WorkflowRunService.js', () => ({
  WorkflowRunService: class MockWorkflowRunService {
    saveWorkflow = mockSaveWorkflow;
  },
}));

vi.mock('../src/services/api/WorkflowTemplateRouteService.js', () => ({
  WorkflowTemplateRouteService: class MockWorkflowTemplateRouteService {
    instantiate = mockInstantiate;
  },
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {}, settings: {} } as unknown as ToolExecutionContext;
}

describe('admin agent write tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveAgent.mockResolvedValue({ status: 'success' });
    mockDeleteAgent.mockResolvedValue({ status: 'success' });
    mockSaveWorkflow.mockResolvedValue({ status: 'success' });
    mockInstantiate.mockResolvedValue({
      status: 'success',
      createdAgents: ['a-new'],
      createdWorkflows: ['wf-new'],
    });
  });

  it('save_agent calls AgentRunService.saveAgent', async () => {
    const t = agentTools.find((x) => x.id === 'save_agent')!;
    const agent = { id: 'a1', name: 'Agent 1', toolIds: [] };
    const r = await t.handler({ agent }, ctx());
    expect(r.ok).toBe(true);
    expect(r.agentId).toBe('a1');
    expect(mockSaveAgent).toHaveBeenCalledWith(agent);
  });

  it('save_agent has medium execution policy', () => {
    const t = agentTools.find((x) => x.id === 'save_agent')!;
    expect(t.execution).toEqual({ readonly: false, riskLevel: 'medium' });
  });

  it('delete_agent calls AgentRunService.deleteAgent', async () => {
    const t = agentTools.find((x) => x.id === 'delete_agent')!;
    const r = await t.handler({ agentId: 'a1' }, ctx());
    expect(r.ok).toBe(true);
    expect(mockDeleteAgent).toHaveBeenCalledWith('a1');
  });

  it('delete_agent returns CONFLICT when referenced by workflows', async () => {
    mockDeleteAgent.mockRejectedValue(new Error('该智能体正被工作流引用：wf1'));
    const t = agentTools.find((x) => x.id === 'delete_agent')!;
    const r = await t.handler({ agentId: 'a1' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('CONFLICT');
  });

  it('delete_agent has high execution policy', () => {
    const t = agentTools.find((x) => x.id === 'delete_agent')!;
    expect(t.execution).toEqual({ readonly: false, riskLevel: 'high' });
  });

  it('save_workflow calls WorkflowRunService.saveWorkflow', async () => {
    const t = agentTools.find((x) => x.id === 'save_workflow')!;
    const workflow = { id: 'wf1', name: 'Workflow 1', steps: [] };
    const r = await t.handler({ workflow }, ctx());
    expect(r.ok).toBe(true);
    expect(r.workflowId).toBe('wf1');
    expect(mockSaveWorkflow).toHaveBeenCalledWith(workflow);
  });

  it('instantiate_template calls WorkflowTemplateRouteService.instantiate', async () => {
    const t = agentTools.find((x) => x.id === 'instantiate_template')!;
    const r = await t.handler(
      { templateId: 'tpl1', variables: { name: 'x' }, conflictStrategy: 'copy' },
      ctx(),
    );
    expect(r.ok).toBe(true);
    expect(r.createdAgents).toEqual(['a-new']);
    expect(mockInstantiate).toHaveBeenCalledWith('tpl1', {
      variables: { name: 'x' },
      conflictStrategy: 'copy',
    });
  });

  it('agentTools has 13 tools including 4 write tools', () => {
    expect(agentTools).toHaveLength(13);
    const writeIds = ['save_agent', 'delete_agent', 'save_workflow', 'instantiate_template'];
    for (const id of writeIds) {
      expect(agentTools.find((x) => x.id === id)).toBeDefined();
    }
  });
});
