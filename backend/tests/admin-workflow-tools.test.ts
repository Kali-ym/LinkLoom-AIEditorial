import { describe, expect, it, vi } from 'vitest';
import { workflowTools } from '../src/plugins/builtin/tools/admin/workflowTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

function ctx(): ToolExecutionContext {
  return {
    store: {
      get: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
    },
    services: {
      workflowOrchestrationService: {
        run: vi.fn().mockResolvedValue({ workflowRunId: 'wr_1', status: 'running' }),
        resumeAfterApproval: vi.fn().mockResolvedValue({ status: 'success' }),
      },
      workflowRunRegistry: {
        get: vi.fn().mockResolvedValue({
          workflowRunId: 'r1',
          workflowId: 'wf1',
          steps: [{ stepId: 's1', status: 'running' }],
          pendingStepApproval: {
            permissionId: 'perm1',
            stepId: 's1',
            toolId: 'human-approval',
            toolName: 'human-approval',
            workflowId: 'wf1',
            toolInput: { input: {}, previewPayload: {} },
            requestedAt: '2026-06-29T00:00:00.000Z',
          },
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as ToolExecutionContext;
}

describe('admin workflow tools', () => {
  it('run_workflow calls orchestration run with input', async () => {
    const t = workflowTools.find((x) => x.id === 'run_workflow')!;
    const c = ctx();
    const r = await t.handler({ workflowId: 'wf1', input: { date: '2026-06-29' } }, c);
    expect(r.ok).toBe(true);
    expect(r.runId).toBe('wr_1');
    expect(c.services.workflowOrchestrationService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf1',
        input: { date: '2026-06-29' },
        source: 'api',
      }),
    );
  });

  it('run_workflow defaults input to {}', async () => {
    const t = workflowTools.find((x) => x.id === 'run_workflow')!;
    const c = ctx();
    await t.handler({ workflowId: 'wf1' }, c);
    expect(c.services.workflowOrchestrationService.run).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'wf1', input: {}, source: 'api' }),
    );
  });

  it('trigger_scoring runs feed_scoring_pipeline_workflow', async () => {
    const t = workflowTools.find((x) => x.id === 'trigger_scoring')!;
    const c = ctx();
    const r = await t.handler({}, c);
    expect(r.ok).toBe(true);
    expect(c.services.workflowOrchestrationService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'feed_scoring_pipeline_workflow',
        input: {},
        source: 'api',
      }),
    );
  });

  it('decide_workflow_step approve resumes after approval', async () => {
    const t = workflowTools.find((x) => x.id === 'decide_workflow_step')!;
    const c = ctx();
    const r = await t.handler({ runId: 'r1', stepId: 's1', decision: 'approve', comment: 'ok' }, c);
    expect(r.ok).toBe(true);
    expect(c.services.workflowOrchestrationService.resumeAfterApproval).toHaveBeenCalled();
  });

  it('decide_workflow_step reject updates registry', async () => {
    const t = workflowTools.find((x) => x.id === 'decide_workflow_step')!;
    const c = ctx();
    const r = await t.handler({ runId: 'r1', stepId: 's1', decision: 'reject' }, c);
    expect(r.ok).toBe(true);
    expect(c.services.workflowRunRegistry.update).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ status: 'cancelled' }),
    );
  });

  it('workflow tools declare medium riskLevel', () => {
    for (const t of workflowTools) {
      expect((t as { execution: { riskLevel: string } }).execution.riskLevel).toBe('medium');
      expect((t as { execution: { readonly: boolean } }).execution.readonly).toBe(false);
    }
  });
});
