import { AppError } from '../../domain/errors.js';
import type { AgentRunFilter, AgentRunSortField } from '../../services/agents/engine/AgentRun.js';
import { AgentSandboxService, tryCreateAgentSandboxService } from '../../services/agents/sandbox/AgentSandboxService.js';
import { AgentRunService } from '../../services/api/AgentRunService.js';
import { streamSseRoute, writeSseComment, writeSseEvent } from '../http.js';
import type { RouteRegistrar } from './types.js';

export const registerAgentRoutes: RouteRegistrar = (fastify, { store, context }) => {
  const service = new AgentRunService(store, context);
  const sandboxService = tryCreateAgentSandboxService(store);

  fastify.get('/api/agents', async () => {
    return service.listVisibleAgents();
  });

  fastify.get('/api/agents/:id', async (request) => {
    const { id } = request.params as { id: string };
    return service.getAgent(id);
  });

  fastify.post('/api/agents', async (request) => {
    return service.saveAgent(request.body as any);
  });

  fastify.get('/api/agents/:id/workflow-references', async (request) => {
    const { id } = request.params as { id: string };
    return service.getAgentWorkflowReferences(id);
  });

  fastify.delete('/api/agents/:id', async (request) => {
    const { id } = request.params as any;
    return service.deleteAgent(id);
  });

  fastify.get('/api/agents/:id/sandbox', async (request) => {
    const { id } = request.params as { id: string };
    return requireSandboxService(sandboxService).getSandbox(id);
  });

  fastify.post('/api/agents/:id/sandbox/start', async (request) => {
    const { id } = request.params as { id: string };
    return requireSandboxService(sandboxService).warmStart(id);
  });

  fastify.post('/api/agents/:id/sandbox/stop', async (request) => {
    const { id } = request.params as { id: string };
    return requireSandboxService(sandboxService).stopSandbox(id);
  });

  fastify.delete('/api/agents/:id/sandbox', async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { clearVolume?: string };
    const clearVolume = query.clearVolume === 'true' || query.clearVolume === '1';
    return requireSandboxService(sandboxService).destroySandbox(id, { clearVolume });
  });

  fastify.post('/api/agents/:id/run', async (request, reply) => {
    const { id } = request.params as any;
    const { input, date, stream: requestStream } = request.body as any;
    const runOptions = parseAgentRunOptions(request.body as any);
    const isStreaming = await service.shouldStreamAgent(id, requestStream);
    if (!isStreaming) {
      return await service.runAgent(id, input, date, runOptions);
    }

    const streamController = new AbortController();
    const cancelOnDisconnect = () => {
      if (!streamController.signal.aborted) streamController.abort('client_disconnect');
    };
    request.raw.on('aborted', cancelOnDisconnect);
    reply.raw.on('close', cancelOnDisconnect);
    await streamSseRoute(reply, async () => {
      try {
        const stream = service.streamAgent(id, input, date, {
          ...runOptions,
          signal: streamController.signal
        });
        for await (const chunk of stream) {
          if (abortStreamIfReplyClosed(reply, streamController)) break;
          writeSseEvent(reply, chunk);
        }
      } finally {
        request.raw.off('aborted', cancelOnDisconnect);
        reply.raw.off('close', cancelOnDisconnect);
      }
    });
  });

  fastify.post('/api/agents/:id/run-stream', async (request, reply) => {
    const { id } = request.params as any;
    const { input, date } = request.body as any;
    const runOptions = parseAgentRunOptions(request.body as any);
    const streamController = new AbortController();
    const cancelOnDisconnect = () => {
      if (!streamController.signal.aborted) streamController.abort('client_disconnect');
    };
    request.raw.on('aborted', cancelOnDisconnect);
    reply.raw.on('close', cancelOnDisconnect);
    await streamSseRoute(reply, async () => {
      try {
        const stream = service.streamAgent(id, input, date, {
          ...runOptions,
          signal: streamController.signal
        });
        for await (const chunk of stream) {
          if (abortStreamIfReplyClosed(reply, streamController)) break;
          writeSseEvent(reply, chunk);
        }
      } finally {
        request.raw.off('aborted', cancelOnDisconnect);
        reply.raw.off('close', cancelOnDisconnect);
      }
    });
  });

  fastify.post('/api/agent-runs', async (request) => {
    return service.startAgentRun(request.body as any);
  });

  fastify.get('/api/agent-runs', async (request) => {
    const query = request.query as Record<string, string | string[] | undefined>;
    const filter: AgentRunFilter = {};
    const agentId = firstQueryValue(query.agentId);
    const workflowId = firstQueryValue(query.workflowId);
    const source = parseListQuery(query.source);
    const status = parseListQuery(query.status);
    const createdAfter = firstQueryValue(query.createdAfter) ?? firstQueryValue(query.createdFrom) ?? firstQueryValue(query.from);
    const createdBefore = firstQueryValue(query.createdBefore) ?? firstQueryValue(query.createdTo) ?? firstQueryValue(query.to);
    const search = firstQueryValue(query.search) ?? firstQueryValue(query.q) ?? firstQueryValue(query.runId) ?? firstQueryValue(query.sessionId);

    if (agentId) filter.agentId = agentId;
    if (workflowId) filter.workflowId = workflowId;
    if (source.length === 1) filter.source = source[0] as AgentRunFilter['source'];
    if (source.length > 1) filter.source = source as AgentRunFilter['source'];
    if (status.length === 1) filter.status = status[0] as AgentRunFilter['status'];
    if (status.length > 1) filter.status = status as AgentRunFilter['status'];
    if (createdAfter) filter.createdAfter = createdAfter;
    if (createdBefore) filter.createdBefore = createdBefore;
    const pendingPermission = parseBooleanQuery(firstQueryValue(query.pendingPermission));
    if (pendingPermission !== undefined) filter.pendingPermission = pendingPermission;
    if (search) filter.search = search;

    const sort = parseRunSort(query);
    const limit = parsePositiveInteger(firstQueryValue(query.limit), 50);
    const page = parsePositiveInteger(firstQueryValue(query.page), 0);
    const offset = firstQueryValue(query.offset)
      ? parsePositiveInteger(firstQueryValue(query.offset), 0)
      : Math.max(0, page - 1) * limit;
    return service.listRuns(filter, sort, offset, limit);
  });

  fastify.get('/api/agent-runs/permissions/pending', async () => {
    return service.listPendingPermissions();
  });

  fastify.get('/api/agent-runs/permissions/history', async (request) => {
    const query = request.query as { limit?: string };
    const limit = parsePositiveInteger(query.limit, 50);
    return service.listPermissionHistory(limit);
  });

  fastify.get('/api/agent-runs/hitl/pending', async () => {
    return service.listPendingHitl();
  });

  fastify.get('/api/agent-runs/observability/metrics', async () => {
    return service.getObservabilityMetrics();
  });

  fastify.get('/api/agent-runs/observability/alerts', async () => {
    return service.getObservabilityAlerts();
  });

  fastify.get('/api/agent-runs/observability/webhook-status', async () => {
    return service.getAlertWebhookStatus();
  });

  fastify.get('/api/agent-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    return service.getSessionState(sessionId);
  });

  fastify.get('/api/agent-sessions/:sessionId/messages', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    return service.getSessionMessages(sessionId);
  });

  fastify.post('/api/agent-sessions/:sessionId/compact-context', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    return service.compactSessionContext(sessionId);
  });

  fastify.patch('/api/agent-sessions/:sessionId/messages/:messageId', async (request) => {
    const { sessionId, messageId } = request.params as { sessionId: string; messageId: string };
    return service.patchSessionMessage(sessionId, messageId, request.body);
  });

  fastify.post('/api/agent-sessions/:sessionId/messages/:messageId/regenerate', async (request) => {
    const { sessionId, messageId } = request.params as { sessionId: string; messageId: string };
    return service.regenerateSessionMessage(sessionId, messageId);
  });

  fastify.patch('/api/agent-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const { topicTitle } = request.body as { topicTitle?: string };
    if (typeof topicTitle !== 'string') {
      throw new AppError(400, 'topicTitle is required');
    }
    return service.patchSessionTopicTitle(sessionId, topicTitle);
  });

  fastify.delete('/api/agent-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    return service.archiveSession(sessionId, request.body as { reason?: string } | undefined);
  });

  fastify.get('/api/agent-threads/:threadId', async (request) => {
    const { threadId } = request.params as { threadId: string };
    return service.getThreadState(threadId);
  });

  fastify.get('/api/agent-threads/:threadId/messages', async (request) => {
    const { threadId } = request.params as { threadId: string };
    return service.getThreadMessages(threadId);
  });

  fastify.get('/api/agent-artifacts/:artifactId', async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    return service.getArtifact(artifactId);
  });

  fastify.get('/api/agent-runs/:runId', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.getRun(runId);
  });

  fastify.get('/api/agent-runs/:runId/session', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.getRunSessionState(runId);
  });

  fastify.get('/api/agent-runs/:runId/messages', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.getRunMessages(runId);
  });

  fastify.get('/api/agent-runs/:runId/artifacts', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.getRunArtifacts(runId);
  });

  fastify.get('/api/agent-runs/:runId/artifacts/:artifactId', async (request) => {
    const { runId, artifactId } = request.params as { runId: string; artifactId: string };
    return service.getRunArtifact(runId, artifactId);
  });

  fastify.post('/api/agent-runs/:runId/cancel', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.cancelRun(runId);
  });

  fastify.post('/api/agent-runs/:runId/archive', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.archiveRun(runId, request.body as any);
  });

  fastify.post('/api/agent-runs/:runId/retry', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.retryRun(runId);
  });

  fastify.get('/api/agent-runs/:runId/events', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const { stream, lastSeq: lastSeqQuery } = request.query as { stream?: string | boolean; lastSeq?: string };
    if (stream !== true && stream !== 'true') {
      return service.getRunEvents(runId);
    }

    // SSE resume: prefer the standard Last-Event-ID header, fall back to ?lastSeq=.
    const lastEventIdHeader = request.headers['last-event-id'];
    const lastSeq = parseLastSeq(
      typeof lastEventIdHeader === 'string' ? lastEventIdHeader : lastSeqQuery
    );

    const streamController = new AbortController();
    const cancelOnDisconnect = () => {
      if (!streamController.signal.aborted) streamController.abort('client_disconnect');
    };
    request.raw.on('aborted', cancelOnDisconnect);
    reply.raw.on('close', cancelOnDisconnect);
    await streamSseRoute(reply, async () => {
      // Flush response headers immediately so clients are not stuck waiting for the
      // first run event (resume may take tens of seconds before any event is published).
      writeSseComment(reply, 'stream-open');
      try {
        for await (const event of service.streamRunEvents(runId, {
          signal: streamController.signal,
          lastSeq
        })) {
          if (abortStreamIfReplyClosed(reply, streamController)) break;
          const eventId = typeof event.sequence === 'number' && Number.isFinite(event.sequence)
            ? event.sequence
            : undefined;
          writeSseEvent(reply, event, eventId == null ? undefined : { id: eventId });
        }
      } finally {
        request.raw.off('aborted', cancelOnDisconnect);
        reply.raw.off('close', cancelOnDisconnect);
      }
    });
  });

  fastify.get('/api/agent-runs/:runId/hitl', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.getRunHitl(runId);
  });

  fastify.post('/api/agent-runs/:runId/hitl/:requestId/resolve', async (request) => {
    const { runId, requestId } = request.params as { runId: string; requestId: string };
    return service.resolveRunHitl(runId, requestId, request.body as any);
  });

  fastify.get('/api/agent-runs/:runId/trace', async (request) => {
    const { runId } = request.params as { runId: string };
    return service.getRunTrace(runId);
  });

  fastify.post('/api/agent-runs/:runId/permissions/:permissionId/approve', async (request) => {
    const { runId, permissionId } = request.params as { runId: string; permissionId: string };
    return service.approvePermission(runId, permissionId, request.body as any);
  });

  fastify.post('/api/agent-runs/:runId/permissions/:permissionId/reject', async (request) => {
    const { runId, permissionId } = request.params as { runId: string; permissionId: string };
    return service.rejectPermission(runId, permissionId, request.body as any);
  });

  fastify.post('/api/agent-runs/:runId/replay', async (request) => {
    const { runId } = request.params as { runId: string };
    const body = (request.body ?? {}) as { execute?: boolean };
    return service.replayRun(runId, body);
  });

  fastify.post('/api/ai/stream', async (request, reply) => {
    const { prompt, systemInstruction, config } = request.body as any;
    const streamController = new AbortController();
    const cancelOnDisconnect = () => {
      if (!streamController.signal.aborted) streamController.abort('client_disconnect');
    };
    request.raw.on('aborted', cancelOnDisconnect);
    reply.raw.on('close', cancelOnDisconnect);
    await streamSseRoute(reply, async () => {
      try {
        const stream = service.streamAiContent(prompt, systemInstruction, config, {
          signal: streamController.signal
        });
        for await (const chunk of stream) {
          if (abortStreamIfReplyClosed(reply, streamController)) break;
          writeSseEvent(reply, chunk);
        }
      } finally {
        request.raw.off('aborted', cancelOnDisconnect);
        reply.raw.off('close', cancelOnDisconnect);
      }
    });
  });
};

function requireSandboxService(service: AgentSandboxService | null): AgentSandboxService {
  if (!service) {
    throw new AppError(503, 'Agent sandbox runtime is not available');
  }
  return service;
}

function abortStreamIfReplyClosed(
  reply: { raw: { writable: boolean } },
  controller: AbortController
): boolean {
  if (reply.raw.writable) return false;
  if (!controller.signal.aborted) controller.abort('client_disconnect');
  return true;
}

function parseBooleanQuery(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

function parseLastSeq(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function parseAgentRunOptions(body: any): {
  noTools: boolean;
  noSkills: boolean;
  threadId?: string;
  sessionId?: string;
  messages?: unknown[];
  attachments?: unknown;
  metadata?: Record<string, unknown>;
} {
  return {
    noTools: body?.noTools === true,
    noSkills: body?.noSkills === true,
    threadId: typeof body?.threadId === 'string' && body.threadId.trim() ? body.threadId : undefined,
    sessionId: typeof body?.sessionId === 'string' && body.sessionId.trim() ? body.sessionId : undefined,
    messages: Array.isArray(body?.messages) ? body.messages : undefined,
    attachments: Array.isArray(body?.attachments) ? body.attachments : undefined,
    metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : undefined
  };
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.find((item) => item.trim().length > 0);
  return value && value.trim().length > 0 ? value : undefined;
}

function parseListQuery(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const next = Number.parseInt(value, 10);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function parseRunSort(query: Record<string, string | string[] | undefined>): AgentRunSortField | undefined {
  const field = firstQueryValue(query.sortField) ?? firstQueryValue(query.sortBy) ?? firstQueryValue(query.sort);
  if (!field) return undefined;
  if (!['createdAt', 'updatedAt', 'durationMs', 'status'].includes(field)) return undefined;
  const direction = firstQueryValue(query.sortOrder) ?? firstQueryValue(query.sortDirection) ?? firstQueryValue(query.order);
  return {
    field: field as AgentRunSortField['field'],
    order: direction === 'asc' ? 'asc' : 'desc'
  };
}
