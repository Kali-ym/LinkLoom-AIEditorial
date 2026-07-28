import { ToolRegistry } from '../../registries/ToolRegistry.js';
import { appendPlatformPermissionHistory } from '../agents/PlatformPermissionHistory.js';
import { executeKvWrite, type KvWriteInput } from '../agents/steps/KvWriteStep.js';
import { WorkflowInputResolver } from '../agents/WorkflowInputResolver.js';
import type { WorkflowRunFilter } from '../agents/WorkflowRun.js';
import type { WorkflowStepPendingApproval } from '../agents/WorkflowStepApproval.js';
import type { LocalStore } from '../LocalStore.js';
import { AgentAuditLogger } from '../audit/AgentAuditLogger.js';
import { markCustomized } from '../seeders/templateMetadata.js';
import type { ServiceContext } from '../ServiceContext.js';

export class WorkflowRunService {
  private readonly inputResolver = new WorkflowInputResolver();
  private readonly agentAudit = new AgentAuditLogger();

  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  listWorkflows() {
    return this.store.listWorkflows();
  }

  async saveWorkflow(workflow: any) {
    await this.store.saveWorkflow(markCustomized(workflow));
    await this.context.reload();
    return { status: 'success' };
  }

  async deleteWorkflow(id: string) {
    await this.store.deleteWorkflow(id);
    await this.context.reload();
    return { status: 'success' };
  }

  runWorkflow(id: string, input: unknown, date?: string, options?: any) {
    const orchestration = this.context.workflowOrchestrationService;
    if (!orchestration) {
      throw new Error('Workflow Engine not initialized');
    }
    return orchestration.run({
      workflowId: id,
      input,
      date,
      source: 'manual',
      timeoutMs: options?.timeoutMs,
      onProgress: options?.onProgress,
      runtimeOptions: options?.runtimeOptions
    });
  }

  listWorkflowRuns(filter?: WorkflowRunFilter, offset = 0, limit = 50) {
    return this.context.workflowRunRegistry.list(filter, offset, limit);
  }

  async getWorkflowRun(workflowRunId: string) {
    const run = await this.context.workflowRunRegistry.get(workflowRunId);
    if (!run) throw new Error(`Workflow run not found: ${workflowRunId}`);
    return run;
  }

  async listPendingWorkflowApprovals(): Promise<WorkflowStepPendingApproval[]> {
    const page = await this.context.workflowRunRegistry.list({ status: 'paused' }, 0, 200);
    return page.items
      .filter((run) => run.pendingStepApproval)
      .map((run) => run.pendingStepApproval as WorkflowStepPendingApproval)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  async approveWorkflowStep(workflowRunId: string, permissionId: string, body?: { reason?: string }) {
    const run = await this.context.workflowRunRegistry.get(workflowRunId);
    if (!run?.pendingStepApproval) {
      throw new Error(`Workflow run ${workflowRunId} has no pending approval`);
    }
    if (run.pendingStepApproval.permissionId !== permissionId) {
      throw new Error(`Permission ${permissionId} does not match pending approval`);
    }

    const approval = run.pendingStepApproval;
    const toolResult = await this.executeApprovedWorkflowStep(approval);
    const orchestration = this.context.workflowOrchestrationService;
    if (!orchestration) {
      throw new Error('Workflow orchestration service not initialized');
    }

    const result = await orchestration.resumeAfterApproval(workflowRunId, toolResult);
    this.agentAudit.log({
      action: 'permission_approved',
      runId: workflowRunId,
      permissionId,
      reason: body?.reason,
      agentId: approval.toolId,
      metadata: {
        kind: 'workflow_step',
        workflowId: approval.workflowId,
        stepId: approval.stepId,
        toolName: approval.toolName
      }
    });
    await appendPlatformPermissionHistory(this.store, {
      kind: 'workflow',
      runId: workflowRunId,
      workflowRunId,
      workflowId: approval.workflowId,
      stepId: approval.stepId,
      permissionId,
      toolName: approval.toolName,
      effect: 'allow',
      reason: body?.reason,
      resolvedBy: 'human',
      requestedAt: approval.requestedAt,
      resolvedAt: new Date().toISOString()
    });
    return { status: 'success', workflowRunId, result };
  }

  async rejectWorkflowStep(workflowRunId: string, permissionId: string, body?: { reason?: string }) {
    const run = await this.context.workflowRunRegistry.get(workflowRunId);
    if (!run?.pendingStepApproval) {
      throw new Error(`Workflow run ${workflowRunId} has no pending approval`);
    }
    if (run.pendingStepApproval.permissionId !== permissionId) {
      throw new Error(`Permission ${permissionId} does not match pending approval`);
    }

    const approval = run.pendingStepApproval;
    const steps = [...run.steps];
    const stepIndex = steps.findIndex((step) => step.stepId === approval.stepId);
    if (stepIndex >= 0) {
      steps[stepIndex] = {
        ...steps[stepIndex],
        status: 'failed',
        error: body?.reason || '审批已拒绝',
        finishedAt: new Date().toISOString()
      };
    }

    await this.context.workflowRunRegistry.update(workflowRunId, {
      status: 'cancelled',
      pendingStepApproval: undefined,
      failedStepId: approval.stepId,
      error: body?.reason || `步骤 ${approval.stepId} 审批被拒绝`,
      finishedAt: new Date().toISOString(),
      steps
    });

    this.agentAudit.log({
      action: 'permission_rejected',
      runId: workflowRunId,
      permissionId,
      reason: body?.reason,
      metadata: {
        kind: 'workflow_step',
        workflowId: approval.workflowId,
        stepId: approval.stepId,
        toolName: approval.toolName
      }
    });
    await appendPlatformPermissionHistory(this.store, {
      kind: 'workflow',
      runId: workflowRunId,
      workflowRunId,
      workflowId: approval.workflowId,
      stepId: approval.stepId,
      permissionId,
      toolName: approval.toolName,
      effect: 'deny',
      reason: body?.reason,
      resolvedBy: 'human',
      requestedAt: approval.requestedAt,
      resolvedAt: new Date().toISOString()
    });
    return { status: 'rejected', workflowRunId };
  }

  private async executeApprovedWorkflowStep(approval: WorkflowStepPendingApproval): Promise<unknown> {
    if (approval.toolId === 'kv-write') {
      const input = approval.toolInput as unknown as KvWriteInput;
      if (!input?.key) throw new Error('kv-write approval is missing key');
      return executeKvWrite(this.store, input);
    }
    if (approval.toolId === 'human-approval') {
      return {
        approved: true,
        previewPayload: approval.toolInput.previewPayload,
        input: approval.toolInput.input,
        reason: approval.toolInput.reason
      };
    }
    return ToolRegistry.getInstance().callTool(approval.toolId, approval.toolInput);
  }

  dryRunStep(body: {
    workflow?: any;
    stepId?: string;
    input?: unknown;
    stepResults?: Record<string, unknown>;
    date?: string;
    runtimeOptions?: Record<string, unknown>;
  }) {
    if (!body.workflow || typeof body.workflow !== 'object') {
      throw new Error('workflow is required');
    }
    if (!body.stepId) {
      throw new Error('stepId is required');
    }
    return this.inputResolver.dryRunStep({
      workflow: body.workflow,
      stepId: body.stepId,
      input: body.input,
      stepResults: body.stepResults as Record<string, any> | undefined,
      date: body.date,
      options: { runtimeOptions: body.runtimeOptions || {} }
    });
  }
}
