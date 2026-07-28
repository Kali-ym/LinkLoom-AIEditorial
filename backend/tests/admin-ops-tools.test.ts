import { describe, expect, it, vi, beforeEach } from 'vitest';
import { opsTools } from '../src/plugins/builtin/tools/admin/opsTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const {
  mockGetWorkflowRun,
  mockListPendingWorkflowApprovals,
  mockNewsGetStatus,
  mockPlatformGetStatus,
  mockGovernanceGetStatus,
  mockGetObservabilityMetrics,
} = vi.hoisted(() => ({
  mockGetWorkflowRun: vi.fn(),
  mockListPendingWorkflowApprovals: vi.fn(),
  mockNewsGetStatus: vi.fn(),
  mockPlatformGetStatus: vi.fn(),
  mockGovernanceGetStatus: vi.fn(),
  mockGetObservabilityMetrics: vi.fn(),
}));

vi.mock('../src/services/api/WorkflowRunService.js', () => ({
  WorkflowRunService: class MockWorkflowRunService {
    getWorkflowRun = mockGetWorkflowRun;
    listPendingWorkflowApprovals = mockListPendingWorkflowApprovals;
  },
}));

vi.mock('../src/services/agents/NewsPipelineService.js', () => ({
  NewsPipelineService: class MockNewsPipelineService {
    getStatus = mockNewsGetStatus;
  },
}));

vi.mock('../src/services/agents/PlatformPipelineService.js', () => ({
  PlatformPipelineService: class MockPlatformPipelineService {
    getStatus = mockPlatformGetStatus;
  },
}));

vi.mock('../src/services/agents/AgentGovernanceService.js', () => ({
  AgentGovernanceService: class MockAgentGovernanceService {
    getStatus = mockGovernanceGetStatus;
  },
}));

vi.mock('../src/services/api/AgentRunService.js', () => ({
  AgentRunService: class MockAgentRunService {
    getObservabilityMetrics = mockGetObservabilityMetrics;
  },
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {} } as unknown as ToolExecutionContext;
}

describe('admin ops tools', () => {
  beforeEach(() => {
    mockGetWorkflowRun.mockReset();
    mockListPendingWorkflowApprovals.mockReset();
    mockNewsGetStatus.mockReset();
    mockPlatformGetStatus.mockReset();
    mockGovernanceGetStatus.mockReset();
    mockGetObservabilityMetrics.mockReset();

    mockGetWorkflowRun.mockResolvedValue({
      workflowRunId: 'wr_1',
      workflowId: 'wf_daily',
      status: 'running',
      steps: [],
    });
    mockListPendingWorkflowApprovals.mockResolvedValue([
      { runId: 'wr_2', stepId: 'step_1', toolName: 'human-approval' },
    ]);
    mockNewsGetStatus.mockResolvedValue({ configured: true, schedules: [] });
    mockPlatformGetStatus.mockResolvedValue({ hotTopics: { enabled: true } });
    mockGovernanceGetStatus.mockResolvedValue({ agents: 5 });
    mockGetObservabilityMetrics.mockResolvedValue({ totalRuns: 10, avgLatencyMs: 1200 });
  });

  it('get_workflow_run returns run', async () => {
    const t = opsTools.find((x) => x.id === 'get_workflow_run')!;
    const r = await t.handler({ runId: 'wr_1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.run.workflowRunId).toBe('wr_1');
    expect(mockGetWorkflowRun).toHaveBeenCalledWith('wr_1');
  });

  it('get_workflow_run includes editorialPlan when in metadata', async () => {
    mockGetWorkflowRun.mockResolvedValue({
      workflowRunId: 'wr_3',
      workflowId: 'wf_daily',
      status: 'succeeded',
      steps: [],
      metadata: { editorialPlan: { topics: [] } },
    });
    const t = opsTools.find((x) => x.id === 'get_workflow_run')!;
    const r = await t.handler({ runId: 'wr_3' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.editorialPlan).toEqual({ topics: [] });
  });

  it('list_pending_approvals returns count and items', async () => {
    const t = opsTools.find((x) => x.id === 'list_pending_approvals')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.items[0].runId).toBe('wr_2');
  });

  it('get_platform_status combines news and platform pipelines', async () => {
    const t = opsTools.find((x) => x.id === 'get_platform_status')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.newsPipeline).toMatchObject({ configured: true });
    expect(r.platformPipelines).toMatchObject({ hotTopics: { enabled: true } });
  });

  it('get_governance_status returns governance', async () => {
    const t = opsTools.find((x) => x.id === 'get_governance_status')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.governance).toMatchObject({ agents: 5 });
  });

  it('get_agent_metrics returns metrics', async () => {
    const t = opsTools.find((x) => x.id === 'get_agent_metrics')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.metrics).toMatchObject({ totalRuns: 10, avgLatencyMs: 1200 });
  });

  it('all ops tools are read-only (no execution policy)', () => {
    for (const t of opsTools) {
      expect((t as { execution?: unknown }).execution).toBeUndefined();
    }
  });
});
