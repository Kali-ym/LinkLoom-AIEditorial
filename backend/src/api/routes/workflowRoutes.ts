import type { WorkflowRunFilter } from '../../services/agents/WorkflowRun.js';
import { WorkflowRunService } from '../../services/api/WorkflowRunService.js';
import { WorkflowStepCatalogService } from '../../services/api/WorkflowStepCatalogService.js';
import { streamSseRoute, writeSseEvent } from '../http.js';
import type { RouteRegistrar } from './types.js';

export const registerWorkflowRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new WorkflowRunService(store, context);
  const catalogService = new WorkflowStepCatalogService(store, context);

  fastify.get('/api/workflows', async () => {
    return await service.listWorkflows();
  });

  fastify.get('/api/workflow-runs', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const filter: WorkflowRunFilter = {};
    if (query.workflowId) filter.workflowId = query.workflowId;
    if (query.source) filter.source = query.source as WorkflowRunFilter['source'];
    if (query.status) filter.status = query.status as WorkflowRunFilter['status'];
    if (query.scheduleId) filter.scheduleId = query.scheduleId;
    const offset = Number.parseInt(query.offset || '0', 10) || 0;
    const limit = Number.parseInt(query.limit || '50', 10) || 50;
    return service.listWorkflowRuns(filter, offset, limit);
  });

  fastify.get('/api/workflow-runs/:workflowRunId', async (request) => {
    const { workflowRunId } = request.params as { workflowRunId: string };
    return service.getWorkflowRun(workflowRunId);
  });

  fastify.post('/api/workflow-runs/:workflowRunId/permissions/:permissionId/approve', async (request) => {
    const { workflowRunId, permissionId } = request.params as {
      workflowRunId: string;
      permissionId: string;
    };
    return service.approveWorkflowStep(workflowRunId, permissionId, request.body as { reason?: string });
  });

  fastify.post('/api/workflow-runs/:workflowRunId/permissions/:permissionId/reject', async (request) => {
    const { workflowRunId, permissionId } = request.params as {
      workflowRunId: string;
      permissionId: string;
    };
    return service.rejectWorkflowStep(workflowRunId, permissionId, request.body as { reason?: string });
  });

  fastify.get('/api/workflows/step-types', async () => {
    return await catalogService.list();
  });

  fastify.post('/api/workflows', async (request) => {
    return service.saveWorkflow(request.body as any);
  });

  fastify.post('/api/workflows/dry-run-step', async (request) => {
    return service.dryRunStep(request.body as any);
  });

  fastify.delete('/api/workflows/:id', async (request) => {
    const { id } = request.params as any;
    return service.deleteWorkflow(id);
  });

  fastify.post('/api/workflows/:id/run', async (request, reply) => {
    const { id } = request.params as any;
    const { input, date, stream, runtimeOptions } = request.body as {
      input?: unknown;
      date?: string;
      stream?: boolean;
      runtimeOptions?: Record<string, unknown>;
    };
    const defaultEditorialMode =
      context.settings.EDITORIAL_CONFIG?.defaultEditorialMode === 'conservative'
        ? 'conservative'
        : 'standard';

    const runOpts = {
      runtimeOptions: {
        ...(runtimeOptions || {}),
        editorialMode: runtimeOptions?.editorialMode ?? defaultEditorialMode
      }
    };

    if (stream !== true) {
      const result = await service.runWorkflow(id, input, date, runOpts);
      return buildResultPayload(result);
    }

    const send = (obj: unknown) => writeSseEvent(reply, obj);

    await streamSseRoute(
      reply,
      async () => {
        const result = await service.runWorkflow(id, input, date, {
          onProgress: (progress: unknown) => send(progress),
          ...runOpts
        });
        send({ type: 'result', ...buildResultPayload(result) });
      },
      'message',
      true
    );
  });
};

/**
 * 把工作流最终输出统一成 { content, data?, report?, editorialPlan? } 形态，
 * 既兼容老的 Markdown 字符串输出，也支持结构化 JSON（JSON 版日报）输出。
 */
function buildResultPayload(result: unknown): {
  content: string;
  data?: unknown;
  report?: unknown;
  editorialPlan?: unknown;
} {
  if (result && typeof result === 'object' && 'content' in (result as Record<string, unknown>)) {
    const r = result as { content: string; editorialPlan?: unknown };
    return {
      content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content),
      editorialPlan: r.editorialPlan
    };
  }
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    return {
      content: JSON.stringify(result),
      data: result,
      report: r.report,
      editorialPlan: r.editorialPlan
    };
  }
  return { content: typeof result === 'string' ? result : JSON.stringify(result ?? '') };
}
