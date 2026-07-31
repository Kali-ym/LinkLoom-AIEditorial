import fs from 'fs/promises';
import { AppError } from '../../domain/errors.js';
import type { AgentEvent, AgentHitlAction, AgentHitlKind, AgentHitlRequest } from '../agents/engine/AgentEvent.js';
import type { AgentRun, AgentRunFilter, AgentRunPage, AgentRunSortField } from '../agents/engine/AgentRun.js';
import type { AgentSession } from '../agents/engine/AgentSession.js';
import type { AgentMessage } from '../agents/engine/AgentRunSpec.js';
import type { AgentRunSpec } from '../agents/engine/AgentRunSpec.js';
import type {
  PromptCachePolicy,
  PromptCacheRuntimeMode
} from '../agents/engine/promptCacheContract.js';
import {
  resolveWorkspacePolicyFromAgent,
  summarizeWorkspacePolicy
} from '../agents/engine/WorkspacePolicyResolver.js';
import { tryCreateAgentSandboxService } from '../agents/sandbox/AgentSandboxService.js';
import type { PermissionRequest } from '../agents/engine/PermissionPolicy.js';
import {
  isArchivableRunStatus,
  isCancellationRequestableRunStatus
} from '../agents/engine/AgentRunStateMachine.js';
import {
  AgentAlertNotifier,
  resolveAlertWebhookUrl,
  type AlertWebhookStatus
} from '../agents/AgentAlertNotifier.js';
import {
  appendPlatformPermissionHistory,
  listPlatformPermissionHistory
} from '../agents/PlatformPermissionHistory.js';
import {
  computeAgentRunAlerts,
  computeAgentRunMetrics,
  type AgentRunAlert,
  type AgentRunMetrics
} from '../agents/AgentRunObservability.js';
import { AgentAuditLogger } from '../audit/AgentAuditLogger.js';
import { SessionMessageService } from '../agents/SessionMessageService.js';
import { findWorkflowsReferencingAgent } from '../../utils/workflowAgentRefs.js';
import { createAIProvider } from '../AIProvider.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { markCustomized } from '../seeders/templateMetadata.js';
import type { ServiceContext } from '../ServiceContext.js';
import { DefaultContextManager } from '../agents/engine/ContextManager.js';
import { TokenCounter } from '../agents/context/TokenCounter.js';
import { ClassifiedMessageBuilder } from '../agents/context/ClassifiedMessageBuilder.js';
import { TokenEstimator } from '../agents/context/TokenEstimator.js';
import { resolveContextProfile } from '../agents/context/ModelContextProfile.js';
import type { ContextUsageSnapshot } from '../agents/context/ContextTokenTypes.js';
import type { AIMessage } from '../../types/index.js';
import { AgentUploadService } from '../agents/AgentUploadService.js';
import { UserTurnFileResolver } from '../agents/UserTurnFileResolver.js';
import { busOrderOf } from '../agents/engine/EventBus.js';
import {
  buildFilesOnlyPrompt,
  buildUserTurnMessageMetadata,
  sanitizeUserTurnMessageForImages,
  normalizeEditUserMessageBody,
  normalizeUserTurnBody,
} from '../agents/userTurnPayload.js';

type AgentApiRunOptions = {
  noTools?: boolean;
  noSkills?: boolean;
  signal?: AbortSignal;
  threadId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  messages?: unknown;
  attachments?: unknown;
  userTurnMetadata?: import('../agents/userTurnPayload.js').UserTurnMessageMetadata;
  promptCacheMode?: PromptCacheRuntimeMode;
  promptCachePolicy?: PromptCachePolicy;
};

export class AgentRunService {
  private readonly agentAudit = new AgentAuditLogger();
  private readonly alertNotifier = new AgentAlertNotifier();

  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async listVisibleAgents() {
    const agents = await this.store.listAgents();
    return agents.filter((agent: any) => !agent.isHidden);
  }

  async saveAgent(agent: any) {
    if (agent.mcpServerIds?.length) {
      const existingMCPs = await this.store.listMCPConfigs();
      const existingIds = new Set(existingMCPs.map((mcp: any) => mcp.id));
      agent.mcpServerIds = agent.mcpServerIds.filter((id: string) => existingIds.has(id));
    }

    await this.store.saveAgent(markCustomized(agent));
    void this.context.reload().catch((error: any) => {
      LogService.warn(
        `Agent ${agent?.id ?? 'unknown'} saved but service reload failed: ${error?.message || error}`,
      );
    });
    return { status: 'success' };
  }

  async getAgent(id: string) {
    const agent = await this.store.getAgent(id);
    if (!agent || agent.isHidden) {
      throw new AppError(404, `Agent ${id} not found`);
    }
    return agent;
  }

  async getAgentWorkflowReferences(id: string) {
    const workflows = await this.store.listWorkflows();
    return findWorkflowsReferencingAgent(id, workflows);
  }

  async deleteAgent(id: string) {
    const refs = await this.getAgentWorkflowReferences(id);
    if (refs.length > 0) {
      const summary = refs.map((wf) => `${wf.name}（${wf.id}）`).join('、');
      throw new AppError(409, `该智能体正被工作流引用：${summary}`);
    }
    const sandboxService = tryCreateAgentSandboxService(this.store);
    if (sandboxService) {
      try {
        await sandboxService.destroySandbox(id, { clearVolume: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogService.warn(`[AgentRunService] Failed to destroy sandbox for agent ${id}: ${message}`);
      }
    }
    await this.store.deleteAgent(id);
    await this.context.reload();
    return { status: 'success' };
  }

  async shouldStreamAgent(id: string, requestStream: unknown) {
    const agentDef = await this.store.getAgent(id);
    return requestStream === true || (agentDef?.streaming === true && requestStream !== false);
  }

  runAgent(
    id: string,
    input: any,
    date?: string,
    options?: AgentApiRunOptions
  ) {
    if (!this.context.agentService) {
      throw new Error('Agent Service not initialized (check AI Provider)');
    }
    const runOptions = normalizeRunOptions(options);
    return runOptions === undefined
      ? this.context.agentService.runAgent(id, input, date)
      : this.context.agentService.runAgent(id, input, date, runOptions);
  }

  streamAgent(
    id: string,
    input: any,
    date?: string,
    options?: AgentApiRunOptions
  ) {
    if (!this.context.agentService) {
      throw new Error('Agent Service not initialized');
    }
    const runOptions = normalizeRunOptions(options);
    return runOptions === undefined
      ? this.context.agentService.streamAgent(id, input, date)
      : this.context.agentService.streamAgent(id, input, date, runOptions);
  }

  async startAgentRun(body: any) {
    const agentService = this.requireAgentService();
    const agentId = body?.agentId || body?.id;
    if (!agentId || typeof agentId !== 'string') {
      throw new AppError(400, 'agentId is required');
    }

    const normalized = normalizeUserTurnBody(body);
    const uploadService = new AgentUploadService(this.store);
    const fileResolver = new UserTurnFileResolver(uploadService);
    const resolvedFiles = await fileResolver.resolve(agentId, normalized.files);

    const sanitizedMessage = sanitizeUserTurnMessageForImages(
      normalized.message,
      resolvedFiles.imageList,
    );
    const prompt =
      sanitizedMessage.trim() ||
      buildFilesOnlyPrompt(resolvedFiles.imageList, resolvedFiles.fileList);

    const userTurnMetadata = buildUserTurnMessageMetadata({
      editorData: normalized.editorData,
      fileList: resolvedFiles.fileList,
      imageList: resolvedFiles.imageList,
      message: sanitizedMessage,
    });

    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    if (sessionId) {
      try {
        await agentService.assertConversationCanAcceptNewRun(sessionId);
      } catch (error) {
        throw new AppError(
          409,
          error instanceof Error ? error.message : 'Conversation has a pending agent run'
        );
      }
    }

    const useStreaming = await this.shouldStreamAgent(agentId, body?.stream ?? true);
    const agentDef = await this.getAgent(agentId);
    const workspacePolicy = resolveWorkspacePolicyFromAgent(agentDef);

    let runSpec: AgentRunSpec | undefined;
    let rejectRunCreated: ((error: unknown) => void) | undefined;
    const runCreated = new Promise<AgentRunSpec>((resolve, reject) => {
      rejectRunCreated = reject;
      const runOptions = {
        noTools: body?.noTools === true,
        noSkills: body?.noSkills === true,
        threadId: typeof body?.threadId === 'string' ? body.threadId : undefined,
        sessionId: typeof body?.sessionId === 'string' ? body.sessionId : undefined,
        workspacePolicy,
        messages: normalizeMessages(body?.messages),
        userTurnMetadata,
        metadata: {
          ...(body?.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
          apiSource: 'agent-runs',
          requestId: body?.requestId
        },
        onRunCreated: (spec: AgentRunSpec) => {
          runSpec = spec;
          resolve(spec);
        }
      };

      const execute = async () => {
        if (useStreaming) {
          for await (const _chunk of agentService.streamAgent(agentId, prompt, body?.date, runOptions)) {
            // Events are published incrementally by the streaming runtime.
          }
          return;
        }
        await agentService.runAgent(agentId, prompt, body?.date, runOptions);
      };

      void execute().catch((error) => {
        const runError = error instanceof Error ? error : new Error(String(error));
        if (!runSpec) {
          reject(runError);
          return;
        }
        LogService.error(
          `[AgentRunService] Background run ${runSpec.runId} failed: ${runError.message}`
        );
      });
    });

    try {
      const spec = await runCreated;
      return {
        runId: spec.runId,
        sessionId: spec.sessionId,
        threadId: spec.threadId,
        status: 'queued',
        source: spec.source,
        agentId: spec.agentDef?.id,
        createdAt: new Date().toISOString(),
        workspace: summarizeWorkspacePolicy(spec.workspacePolicy ?? workspacePolicy)
      };
    } catch (error) {
      rejectRunCreated?.(error);
      throw error;
    }
  }

  async listRuns(
    filter?: AgentRunFilter,
    sort?: AgentRunSortField,
    offset?: number,
    limit?: number
  ): Promise<AgentRunPage> {
    const registry = this.requireAgentService().getRunRegistryInstance();
    if (!registry) {
      return { items: [], total: 0, offset: offset ?? 0, limit: limit ?? 50 };
    }
    const page = await registry.list(filter, sort, offset, limit);
    if (filter?.status) return page;
    const items = page.items.filter((run) => run.status !== 'archived');
    return {
      ...page,
      items,
      total: Math.max(0, page.total - (page.items.length - items.length)),
    };
  }

  async getRun(runId: string) {
    const agentService = this.requireAgentService();
    const registry = agentService.getRunRegistryInstance();
    const run = registry ? await registry.get(runId) : null;
    const session = await agentService.getRunSession(runId);

    if (!run && !session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }

    return this.buildRunDetail(run, session);
  }

  async getRunStatus(runId: string) {
    const session = await this.requireAgentService().getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    return this.buildRunDetail(null, session);
  }

  async getRunSessionState(runId: string) {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    return this.buildSessionState(session);
  }

  async getSessionState(sessionId: string) {
    const agentService = this.requireAgentService();
    const session = await agentService.getSession(sessionId);
    if (!session) {
      throw new AppError(404, `Agent session not found: ${sessionId}`);
    }
    const sessions = typeof agentService.getSessionRuns === 'function'
      ? await agentService.getSessionRuns(sessionId)
      : [session];
    return this.buildSessionGroupState(sessionId, sessions.length > 0 ? sessions : [session], session);
  }

  async getRunMessages(runId: string) {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    return this.buildMessagesResponse(session, agentService.getSessionMessages(session));
  }

  async getRunArtifacts(runId: string) {
    const session = await this.requireRunSession(runId);
    return {
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      artifacts: session.artifacts
    };
  }

  async getRunArtifact(runId: string, artifactId: string) {
    const session = await this.requireRunSession(runId);
    const artifact = session.artifacts.find((item) => item.artifactId === artifactId);
    if (!artifact) {
      throw new AppError(404, `Agent artifact not found: ${artifactId}`);
    }

    const content = await readArtifactContent(artifact);
    return {
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      artifact,
      content
    };
  }

  async getArtifact(artifactId: string) {
    const sessions = await this.requireAgentService().listRunSessions();
    const session = sessions.find((item) =>
      item.artifacts.some((artifact) => artifact.artifactId === artifactId)
    );
    const artifact = session?.artifacts.find((item) => item.artifactId === artifactId);
    if (!session || !artifact) {
      throw new AppError(404, `Agent artifact not found: ${artifactId}`);
    }

    const content = await readArtifactContent(artifact);
    return {
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      artifact,
      content
    };
  }

  async getSessionMessages(sessionId: string) {
    const agentService = this.requireAgentService();
    const session = await agentService.getSession(sessionId);
    if (!session) {
      throw new AppError(404, `Agent session not found: ${sessionId}`);
    }
    const sessions = typeof agentService.getSessionRuns === 'function'
      ? await agentService.getSessionRuns(sessionId)
      : [session];
    const runSessions = sessions.length > 0 ? sessions : [session];
    return {
      sessionId,
      threadId: runSessions.at(-1)?.threadId ?? session.threadId,
      runIds: runSessions.map((item) => item.runId),
      messages: runSessions.flatMap((item) => agentService.getSessionTurnMessages(item))
    };
  }

  /**
   * Manually compact a session's context: trim historical messages via the
   * default ContextManager (heuristic truncation, no LLM summary cost), persist
   * the trimmed message list back to the session, and return a fresh context
   * usage snapshot so the UI can reflect the reduced token count immediately.
   */
  async compactSessionContext(sessionId: string): Promise<{
    sessionId: string;
    compacted: boolean;
    beforeMessages: number;
    afterMessages: number;
    snapshot?: ContextUsageSnapshot;
  }> {
    const agentService = this.requireAgentService();
    const session = await agentService.getSession(sessionId);
    if (!session) {
      throw new AppError(404, `Agent session not found: ${sessionId}`);
    }

    const turnMessages = agentService.getSessionTurnMessages(session);
    const beforeMessages = turnMessages.length;
    if (beforeMessages === 0) {
      return { sessionId, compacted: false, beforeMessages: 0, afterMessages: 0 };
    }

    // AgentMessage -> AIMessage (mirrors AgentService.toRuntimeMessages)
    const aiMessages: AIMessage[] = turnMessages
      .filter((m) => m.role === 'system' || m.role === 'user' || m.role === 'assistant' || m.role === 'tool')
      .map((m) => ({
        role: m.role as AIMessage['role'],
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        name: m.name,
        tool_call_id: m.toolCallId,
        tool_calls: Array.isArray(m.metadata?.toolCalls) ? m.metadata.toolCalls : undefined,
        raw_parts: Array.isArray(m.metadata?.rawParts) ? m.metadata.rawParts : undefined
      }));

    const contextManager = new DefaultContextManager();
    // Force the compaction path: a tiny maxInputTokens makes the token-budget
    // guard always trigger so the trim strategy runs even when the session is
    // well below the model's real context window. maxMessages defaults to 30
    // inside the manager; messages shorter than that are kept verbatim.
    const result = await contextManager.compactMessages(aiMessages, {
      policy: { compactionStrategy: 'trim', maxInputTokens: 1, maxMessages: 30 }
    });
    if (!result.compacted || result.messages.length >= aiMessages.length) {
      return { sessionId, compacted: false, beforeMessages, afterMessages: beforeMessages };
    }

    // AIMessage -> AgentMessage (only the fields needed for subsequent runs)
    const compactedAgentMessages: AgentMessage[] = result.messages.map((m) => ({
      role: m.role as AgentMessage['role'],
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
      name: m.name,
      toolCallId: m.tool_call_id,
      metadata: m.tool_calls ? { toolCalls: m.tool_calls } : undefined
    }));

    const updatedSession: AgentSession = { ...session, messages: compactedAgentMessages };
    await agentService.saveRunSession(updatedSession);

    // Measure the post-compaction snapshot for UI feedback.
    let snapshot: ContextUsageSnapshot | undefined;
    try {
      const agentId = this.resolveSessionAgentId(session);
      const agentDef = agentId ? await this.store.getAgent(agentId) : undefined;
      const providerId = agentDef?.providerId ?? 'openai';
      const model = agentDef?.model ?? 'gpt-4o';
      const profile = resolveContextProfile(providerId, model);
      const counter = new TokenCounter(
        new TokenEstimator({ driftMultiplier: profile.driftMultiplier, encoding: profile.encoding }),
        profile
      );
      const builder = new ClassifiedMessageBuilder();
      const classified = builder.build(result.messages, [], new Set());
      const breakdown = counter.count(classified);
      snapshot = counter.toSnapshot(breakdown, { round: 0, compacted: true, source: 'counter' });
    } catch (error) {
      LogService.warn(`[compactSessionContext] snapshot measurement failed: ${(error as Error).message}`);
    }

    return {
      sessionId,
      compacted: true,
      beforeMessages,
      afterMessages: compactedAgentMessages.length,
      snapshot
    };
  }

  async patchSessionMessage(sessionId: string, messageId: string, body: unknown) {
    const normalized = normalizeEditUserMessageBody(body);
    const located = await new SessionMessageService(this.requireAgentService()).locateMessage(
      sessionId,
      messageId,
    );
    const agentId = this.resolveSessionAgentId(located.session);
    if (!agentId) {
      throw new AppError(400, 'Cannot determine agentId for message edit');
    }

    const uploadService = new AgentUploadService(this.store);
    const fileResolver = new UserTurnFileResolver(uploadService);
    const resolvedFiles = await fileResolver.resolve(agentId, normalized.files);

    const service = new SessionMessageService(this.requireAgentService());
    return service.editMessage(sessionId, messageId, normalized, resolvedFiles);
  }

  async regenerateSessionMessage(sessionId: string, messageId: string) {
    const agentService = this.requireAgentService();
    const service = new SessionMessageService(agentService);
    const prepared = await service.prepareRegeneration(sessionId, messageId);
    const started = await this.startAgentRun({
      agentId: prepared.agentId,
      message: prepared.userTurn.message,
      editorData: prepared.userTurn.editorData,
      files: prepared.userTurn.files,
      sessionId: prepared.sessionId,
      threadId: prepared.threadId,
      messages: prepared.messages,
      metadata: {
        regeneratedFrom: messageId,
        requestKind: 'message_regenerate',
      },
    });
    return {
      ...started,
      input: prepared.userTurn.message,
      message: prepared.message,
    };
  }

  private resolveSessionAgentId(session: AgentSession): string | undefined {
    const metadataAgentId = session.metadata?.agentId;
    return typeof metadataAgentId === 'string' && metadataAgentId.trim()
      ? metadataAgentId
      : undefined;
  }

  async getThreadState(threadId: string) {
    const agentService = this.requireAgentService();
    const sessions = await agentService.getThreadSessions(threadId);
    if (sessions.length === 0) {
      throw new AppError(404, `Agent thread not found: ${threadId}`);
    }
    return this.buildThreadState(threadId, sessions);
  }

  async getThreadMessages(threadId: string) {
    const agentService = this.requireAgentService();
    const sessions = await agentService.getThreadSessions(threadId);
    if (sessions.length === 0) {
      throw new AppError(404, `Agent thread not found: ${threadId}`);
    }
    return {
      threadId,
      sessionIds: [...new Set(sessions.map((session) => session.sessionId))],
      runIds: sessions.map((session) => session.runId),
      messages: await agentService.getThreadMessages(threadId)
    };
  }

  async getRunEvents(runId: string): Promise<AgentEvent[]> {
    const events = await this.requireAgentService().getRunEvents(runId);
    if (events.length === 0) {
      const session = await this.requireAgentService().getRunSession(runId);
      if (!session) {
        throw new AppError(404, `Agent run not found: ${runId}`);
      }
    }
    return events;
  }

  async listPendingHitl() {
    return this.requireAgentService().listPendingHitl();
  }

  async getRunHitl(runId: string) {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    return {
      runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      status: session.status,
      pendingHitl: await agentService.getRunHitl(runId)
    };
  }

  async resolveRunHitl(runId: string, requestId: string, body: any) {
    const action = normalizeHitlAction(body?.action);
    if (!action) {
      throw new AppError(400, 'action is required');
    }
    const kind = normalizeHitlKind(body?.kind);
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    const pendingHitl = session.pendingHitl;
    if (!pendingHitl) {
      throw new AppError(400, `Agent run has no pending HITL request: ${runId}`);
    }
    if (pendingHitl.requestId !== requestId) {
      throw new AppError(400, `HITL resolution does not match pending request: ${requestId}`);
    }
    validateHitlResolutionBody(pendingHitl, {
      action,
      kind,
      editedArguments: body?.editedArguments,
      input: body?.input,
      externalResult: body?.externalResult
    });
    try {
      return await agentService.resolveRunHitl({
        runId,
        requestId,
        action,
        kind,
        reason: typeof body?.reason === 'string' ? body.reason : undefined,
        editedArguments: body?.editedArguments,
        input: body?.input,
        externalResult: body?.externalResult,
        metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : undefined
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      if (message.includes('not found')) throw new AppError(404, message);
      throw new AppError(400, message);
    }
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    if (!isCancellationRequestableRunStatus(session.status)) {
      throw new AppError(400, `Only active runs can be cancelled (current: ${session.status})`);
    }
    const result = await agentService.cancelRun(runId, 'manual');
    this.agentAudit.log({
      action: 'run_cancelled',
      runId,
      agentId: session.metadata?.agentId as string | undefined
    });
    return result;
  }

  async archiveRun(runId: string, body?: any): Promise<{ status: string }> {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    if (!isArchivableRunStatus(session.status)) {
      throw new AppError(400, `Only terminal runs can be archived (current: ${session.status})`);
    }
    const reason = typeof body?.reason === 'string' ? body.reason : undefined;
    const result = await agentService.archiveRun(runId, reason);
    this.agentAudit.log({
      action: 'run_archived',
      runId,
      agentId: session.metadata?.agentId as string | undefined,
      metadata: { reason }
    });
    return result;
  }

  async patchSessionTopicTitle(
    sessionId: string,
    topicTitle: string,
  ): Promise<{ sessionId: string; topicTitle: string; updatedRunIds: string[] }> {
    const agentService = this.requireAgentService();
    const sessions = await agentService.getSessionRuns(sessionId);
    if (sessions.length === 0) {
      throw new AppError(404, `Agent session not found: ${sessionId}`);
    }

    const trimmed = topicTitle.trim().slice(0, 80);
    if (!trimmed) {
      throw new AppError(400, 'topicTitle is required');
    }

    const registry = agentService.getRunRegistryInstance();
    if (!registry) {
      throw new AppError(501, 'Run registry unavailable');
    }

    const updatedRunIds: string[] = [];
    for (const session of sessions) {
      const latest = await agentService.getRunSession(session.runId);
      if (!latest) continue;
      await registry.update(latest.runId, {
        metadata: { ...(latest.metadata ?? {}), topicTitle: trimmed },
      });
      updatedRunIds.push(latest.runId);
    }

    return { sessionId, topicTitle: trimmed, updatedRunIds };
  }

  async archiveSession(
    sessionId: string,
    body?: { reason?: string },
  ): Promise<{ sessionId: string; archivedRunIds: string[] }> {
    const agentService = this.requireAgentService();
    const sessions = await agentService.getSessionRuns(sessionId);
    if (sessions.length === 0) {
      // Idempotent delete: client-only drafts (tpc_*) may never create a backend run.
      return { sessionId, archivedRunIds: [] };
    }

    const reason = typeof body?.reason === 'string' ? body.reason : 'topic_deleted';
    const archivedRunIds: string[] = [];
    const registry = agentService.getRunRegistryInstance();

    for (const session of sessions) {
      if (session.status === 'archived') {
        archivedRunIds.push(session.runId);
        continue;
      }

      if (isCancellationRequestableRunStatus(session.status)) {
        await agentService.cancelRun(session.runId, reason);
      }

      let latest = await agentService.getRunSession(session.runId);
      if (!latest) continue;

      if (latest.status === 'archived') {
        archivedRunIds.push(latest.runId);
        continue;
      }

      if (isArchivableRunStatus(latest.status)) {
        await agentService.archiveRun(latest.runId, reason);
        archivedRunIds.push(latest.runId);
        this.agentAudit.log({
          action: 'run_archived',
          runId: latest.runId,
          agentId: latest.metadata?.agentId as string | undefined,
          metadata: { reason, sessionId },
        });
        continue;
      }

      if (registry) {
        await registry.update(latest.runId, {
          metadata: { ...(latest.metadata ?? {}), topicDeleted: true },
        });
        archivedRunIds.push(latest.runId);
      }
    }

    return { sessionId, archivedRunIds };
  }

  async retryRun(runId: string): Promise<{ runId: string; sessionId: string; threadId?: string; status: string }> {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    if (!['failed', 'cancelled'].includes(session.status)) {
      throw new AppError(400, `Only failed or cancelled runs can be retried (current: ${session.status})`);
    }
    // Extract original input from first user message
    const firstUserMsg = session.messages.find((m: any) => m.role === 'user');
    const input = firstUserMsg?.content ?? '';
    const agentId = session.metadata?.agentId as string | undefined
      ?? (session as any).agentId;
    if (!agentId) {
      throw new AppError(400, 'Cannot determine agentId for retry');
    }
    const started = await this.startAgentRun({
      agentId,
      input,
      metadata: { retriedFrom: runId },
    });
    this.agentAudit.log({
      action: 'run_retried',
      runId,
      agentId,
      metadata: { newRunId: started.runId }
    });
    return started;
  }

  async *streamRunEvents(
    runId: string,
    options: { signal?: AbortSignal; lastSeq?: number } = {}
  ): AsyncIterable<AgentEvent> {
    const agentService = this.requireAgentService();
    const signal = options.signal;
    const lastSeq = typeof options.lastSeq === 'number' && Number.isFinite(options.lastSeq) ? options.lastSeq : 0;
    const backlog = await agentService.getRunEvents(runId);
    const session = await agentService.getRunSession(runId);
    if (!session && backlog.length === 0) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }

    // Track the highest sequence we have delivered so the NOTIFY-driven pull stays
    // gap-free and de-duplicated, and so reconnects can resume from `lastSeq`.
    let deliveredSeq = lastSeq;
    const seenIds = new Set<string>();
    const seenBusOrders = new Set<number>();

    // Backlog merge: DB-persisted events (positive seq, may be missing ephemeral
    // deltas) + in-memory bus events (has ephemeral deltas with negative seq and
    // a `_busOrder` stamp = real publish order). Merge by id, then sort by
    // `_busOrder` so deltas and persisted events land in the order they actually
    // happened — not in seq order (which would put every ephemeral delta after
    // every persisted event and scramble the UI).
    const liveBacklog =
      typeof agentService.getRunLiveEvents === 'function' ? agentService.getRunLiveEvents(runId) : [];
    const mergedBacklog = new Map<string, AgentEvent>();
    for (const event of backlog) {
      if (event.id) mergedBacklog.set(event.id, event);
      else mergedBacklog.set(`seq:${seqOf(event)}`, event);
    }
    for (const event of liveBacklog) {
      const key = event.id ?? `seq:${seqOf(event)}`;
      if (!mergedBacklog.has(key)) mergedBacklog.set(key, event);
    }
    const orderedBacklog = [...mergedBacklog.values()].sort((a, b) => {
      const oa = busOrderOf(a);
      const ob = busOrderOf(b);
      if (oa !== ob) return oa - ob;
      return seqOf(a) - seqOf(b);
    });

    for (const event of orderedBacklog) {
      if (signal?.aborted) return;
      if (lastSeq > 0 && seqOf(event) > 0 && seqOf(event) <= lastSeq) continue; // last-seq resume: skip seen prefix
      if (event.id) seenIds.add(event.id);
      const order = busOrderOf(event);
      if (Number.isFinite(order)) seenBusOrders.add(order);
      deliveredSeq = Math.max(deliveredSeq, seqOf(event));
      yield event;
    }

    if (signal?.aborted) return;

    const hasClosingEvent = backlog.some((event) => isRunClosingEvent(event.type));
    if (
      hasClosingEvent ||
      (session && ['succeeded', 'failed', 'cancelled', 'archived'].includes(session.status))
    ) {
      return;
    }

    const queue: AgentEvent[] = [];
    let notify: (() => void) | undefined;
    let closed = false;
    const wake = () => notify?.();

    const enqueue = (event: AgentEvent) => {
      if (event.id && seenIds.has(event.id)) return;
      if (event.id) seenIds.add(event.id);
      const order = busOrderOf(event);
      let insertAt = queue.length;
      while (insertAt > 0 && busOrderOf(queue[insertAt - 1]!) > order) {
        insertAt -= 1;
      }
      queue.splice(insertAt, 0, event);
      if (isRunClosingEvent(event.type)) closed = true;
    };

    // Local (same-instance) delivery via the in-process event bus.
    const unsubscribe = agentService.subscribeRunEvents(runId, (event) => {
      enqueue(event);
      wake();
    });

    // Cross-process delivery: a NOTIFY from another instance only carries runId+seq, so
    // pull the actual events from agent_events incrementally and enqueue them.
    let pulling = false;
    const pullSince = async () => {
      if (pulling || typeof agentService.getRunEventsAfter !== 'function') return;
      pulling = true;
      try {
        const fresh = await agentService.getRunEventsAfter(runId, deliveredSeq);
        for (const event of fresh) {
          deliveredSeq = Math.max(deliveredSeq, seqOf(event));
          enqueue(event);
        }
      } catch {
        /* tolerate transient read failures; next signal retries */
      } finally {
        pulling = false;
      }
      wake();
    };
    const unsubscribeSignals = typeof agentService.subscribeRunEventSignals === 'function'
      ? agentService.subscribeRunEventSignals((sig) => {
          if (sig.runId !== runId) return;
          void pullSince();
        })
      : () => undefined;

    const abortListener = () => {
      closed = true;
      wake();
    };
    signal?.addEventListener('abort', abortListener, { once: true });

    // Close the race between backlog replay and subscription setup: any event persisted
    // after the initial backlog read but before local/NOTIFY subscriptions are attached
    // is picked up here even if its wake-up was missed.
    void pullSince();

    // LISTEN/NOTIFY is best-effort. A low-frequency catch-up poll prevents a long-lived
    // SSE stream from hanging forever when a notification is dropped or the LISTEN client
    // reconnects after an event was already persisted.
    const catchupPoll = setInterval(() => {
      if (!closed && !signal?.aborted) void pullSince();
    }, 2_000);
    if (typeof catchupPoll.unref === 'function') catchupPoll.unref();

    try {
      while (!signal?.aborted && (!closed || queue.length > 0)) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            notify = resolve;
            if (signal?.aborted || closed) resolve();
          });
          notify = undefined;
          continue;
        }
        const event = queue.shift();
        if (event) {
          deliveredSeq = Math.max(deliveredSeq, seqOf(event));
          yield event;
        }
      }
    } finally {
      clearInterval(catchupPoll);
      signal?.removeEventListener('abort', abortListener);
      unsubscribe();
      unsubscribeSignals();
    }
  }

  async getRunTrace(runId: string) {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    return {
      runId: session.runId,
      sessionId: session.sessionId,
      trace: await agentService.getRunTrace(runId),
      events: session.events,
      output: session.output ?? null
    };
  }

  async approvePermission(runId: string, permissionId: string, body: any) {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    const result = await agentService.resolveRunPermission({
      runId,
      permissionId,
      effect: 'allow',
      reason: body?.reason,
      resolvedBy: 'human'
    });
    this.agentAudit.log({
      action: 'permission_approved',
      runId,
      permissionId,
      reason: body?.reason,
      agentId: session?.metadata?.agentId as string | undefined
    });
    const pending = session?.pendingPermission;
    await appendPlatformPermissionHistory(this.store, {
      kind: 'agent',
      runId,
      sessionId: session?.sessionId,
      agentId: session?.metadata?.agentId as string | undefined,
      workflowId: session?.metadata?.workflowId as string | undefined,
      workflowRunId: session?.metadata?.workflowRunId as string | undefined,
      stepId: session?.metadata?.stepId as string | undefined,
      permissionId,
      toolName: pending?.subject?.toolName,
      effect: 'allow' as const,
      reason: body?.reason,
      resolvedBy: 'human',
      requestedAt: pending?.requestedAt ?? new Date().toISOString(),
      resolvedAt: new Date().toISOString()
    });
    return result;
  }

  async rejectPermission(runId: string, permissionId: string, body: any) {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    const result = await agentService.resolveRunPermission({
      runId,
      permissionId,
      effect: 'deny',
      reason: body?.reason,
      resolvedBy: 'human'
    });
    this.agentAudit.log({
      action: 'permission_rejected',
      runId,
      permissionId,
      reason: body?.reason,
      agentId: session?.metadata?.agentId as string | undefined
    });
    const pending = session?.pendingPermission;
    await appendPlatformPermissionHistory(this.store, {
      kind: 'agent',
      runId,
      sessionId: session?.sessionId,
      agentId: session?.metadata?.agentId as string | undefined,
      workflowId: session?.metadata?.workflowId as string | undefined,
      workflowRunId: session?.metadata?.workflowRunId as string | undefined,
      stepId: session?.metadata?.stepId as string | undefined,
      permissionId,
      toolName: pending?.subject?.toolName,
      effect: 'deny',
      reason: body?.reason,
      resolvedBy: 'human',
      requestedAt: pending?.requestedAt ?? new Date().toISOString(),
      resolvedAt: new Date().toISOString()
    });
    return result;
  }

  async getObservabilityMetrics(): Promise<AgentRunMetrics> {
    const { runs, sessions } = await this.collectObservabilityData();
    return computeAgentRunMetrics(runs, sessions);
  }

  async getObservabilityAlerts(): Promise<AgentRunAlert[]> {
    const { runs, sessions } = await this.collectObservabilityData();
    const alerts = [...computeAgentRunAlerts(runs, sessions), ...(await this.collectWorkflowAlerts())].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
    const webhookUrl = resolveAlertWebhookUrl(this.context.settings);
    void this.alertNotifier.dispatch(alerts, webhookUrl);
    return alerts;
  }

  getAlertWebhookStatus(): AlertWebhookStatus {
    return this.alertNotifier.getStatus();
  }

  async listPendingPermissions(): Promise<PendingPermissionItem[]> {
    const sessions = await this.requireAgentService().listRunSessions();
    const agentItems: PendingPermissionItem[] = sessions
      .filter((session) => session.pendingPermission)
      .map((session) => ({
        kind: 'agent' as const,
        runId: session.runId,
        sessionId: session.sessionId,
        agentId: session.metadata?.agentId as string | undefined,
        workflowId: session.metadata?.workflowId as string | undefined,
        workflowRunId: session.metadata?.workflowRunId as string | undefined,
        stepId: session.metadata?.stepId as string | undefined,
        permission: session.pendingPermission as PermissionRequest,
        runStatus: session.status,
        createdAt: session.createdAt
      }));

    const workflowItems: PendingPermissionItem[] = [];
    const workflowPage = await this.context.workflowRunRegistry.list({ status: 'paused' }, 0, 200);
    for (const run of workflowPage.items) {
      const approval = run.pendingStepApproval;
      if (!approval) continue;
      workflowItems.push({
        kind: 'workflow',
        workflowRunId: run.workflowRunId,
        workflowId: run.workflowId,
        workflowName: run.workflowName ?? approval.workflowName,
        stepId: approval.stepId,
        stepDisplayName: approval.stepDisplayName,
        permission: {
          permissionId: approval.permissionId,
          runId: run.workflowRunId,
          sessionId: run.workflowRunId,
          subject: {
            toolName: approval.toolName,
            actionKind: 'publish',
            riskLevel: 'high'
          },
          arguments: approval.toolInput,
          reason: approval.reason,
          requestedAt: approval.requestedAt
        },
        runStatus: 'paused',
        createdAt: approval.requestedAt
      });
    }

    return [...agentItems, ...workflowItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPermissionHistory(limit = 50): Promise<PermissionHistoryItem[]> {
    const sessions = await this.requireAgentService().listRunSessions();
    const items: PermissionHistoryItem[] = [];

    for (const session of sessions) {
      const requests = new Map<string, PermissionRequest>();
      for (const event of session.events) {
        if (event.type === 'permission_required') {
          requests.set(event.payload.permissionId, event.payload);
        }
        if (event.type === 'permission_resolved' && event.payload.effect !== 'ask') {
          const request = requests.get(event.payload.permissionId);
          items.push({
            runId: session.runId,
            sessionId: session.sessionId,
            agentId: session.metadata?.agentId as string | undefined,
            permissionId: event.payload.permissionId,
            toolName: request?.subject?.toolName,
            effect: event.payload.effect,
            reason: event.payload.reason,
            resolvedBy: event.payload.resolvedBy,
            requestedAt: request?.requestedAt ?? event.timestamp,
            resolvedAt: event.payload.resolvedAt
          });
        }
      }
    }

    const platformItems = (await listPlatformPermissionHistory(this.store, limit)).map((entry) => ({
      runId: entry.runId,
      sessionId: entry.sessionId ?? entry.runId,
      agentId: entry.agentId,
      permissionId: entry.permissionId,
      toolName: entry.toolName,
      effect: entry.effect,
      reason: entry.reason,
      resolvedBy: entry.resolvedBy,
      requestedAt: entry.requestedAt,
      resolvedAt: entry.resolvedAt,
      kind: entry.kind,
      workflowId: entry.workflowId,
      workflowRunId: entry.workflowRunId,
      stepId: entry.stepId
    }));

    const merged = new Map<string, PermissionHistoryItem>();
    for (const item of [...items, ...platformItems]) {
      const key = `${item.runId}_${item.permissionId}_${item.resolvedAt}`;
      if (!merged.has(key)) merged.set(key, item);
    }

    return [...merged.values()]
      .sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt))
      .slice(0, Math.max(1, limit));
  }

  async replayRun(runId: string, body?: { execute?: boolean }) {
    const agentService = this.requireAgentService();
    const session = await agentService.getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }

    const original = {
      runId: session.runId,
      sessionId: session.sessionId,
      status: session.status,
      events: session.events,
      output: session.output ?? null,
      trace: session.output?.trace ?? null,
      messages: session.messages
    };

    let replayRunId: string | undefined;
    let replaySessionId: string | undefined;
    let replayStatus: string | undefined;

    if (body?.execute !== false) {
      const agentId = session.metadata?.agentId as string | undefined;
      const firstUserMsg = session.messages.find((message) => message.role === 'user');
      const input = extractMessageContent(firstUserMsg?.content);

      if (agentId && input) {
        const started = await this.startAgentRun({
          agentId,
          input,
          date: session.metadata?.date as string | undefined,
          metadata: {
            replayedFrom: runId,
            replaySource: session.source
          }
        });
        replayRunId = started.runId;
        replaySessionId = started.sessionId;
        replayStatus = started.status;
      }
    }

    this.agentAudit.log({
      action: 'run_replayed',
      runId,
      agentId: session.metadata?.agentId as string | undefined,
      metadata: { replayRunId, execute: body?.execute !== false }
    });

    return {
      originalRunId: runId,
      original,
      replayRunId,
      replaySessionId,
      replayStatus
    };
  }

  private async collectObservabilityData(): Promise<{ runs: AgentRun[]; sessions: AgentSession[] }> {
    const agentService = this.requireAgentService();
    const sessions = await agentService.listRunSessions();
    const registry = agentService.getRunRegistryInstance();
    const page = registry
      ? await registry.list(undefined, { field: 'createdAt', order: 'desc' }, 0, 1000)
      : { items: [] as AgentRun[] };

    const runMap = new Map(page.items.map((run) => [run.runId, run]));
    for (const session of sessions) {
      if (runMap.has(session.runId)) continue;
      runMap.set(session.runId, sessionToRunSummary(session));
    }

    return { runs: [...runMap.values()], sessions };
  }

  private async collectWorkflowAlerts(): Promise<AgentRunAlert[]> {
    const page = await this.context.workflowRunRegistry.list({ status: 'paused' }, 0, 100);
    const alerts: AgentRunAlert[] = [];
    for (const run of page.items) {
      const approval = run.pendingStepApproval;
      if (!approval) continue;
      alerts.push({
        id: `workflow_paused_${run.workflowRunId}`,
        type: 'pending_permission_pileup',
        severity: 'warning',
        message: `编排等待审批：${run.workflowName || run.workflowId} · ${approval.stepDisplayName || approval.stepId}（${approval.toolName}）`,
        runId: run.workflowRunId,
        createdAt: approval.requestedAt,
        metadata: {
          kind: 'workflow_step',
          workflowId: run.workflowId,
          stepId: approval.stepId,
          toolName: approval.toolName,
          permissionId: approval.permissionId
        }
      });
    }
    return alerts;
  }

  private buildRunDetail(run: AgentRun | null, session: AgentSession | null) {
    const events = session?.events ?? [];
    const output = session?.output ?? run?.output ?? null;
    const runId = run?.runId ?? session?.runId;
    const sessionId = run?.sessionId ?? session?.sessionId;
    const finishedEvent = [...events]
      .reverse()
      .find((event) => event.type === 'run_finished' || event.type === 'run_failed');
    const createdAt = run?.createdAt ?? session?.createdAt ?? events[0]?.timestamp ?? new Date().toISOString();
    const updatedAt = run?.updatedAt ?? session?.updatedAt ?? finishedEvent?.timestamp ?? createdAt;
    const durationMs = run?.durationMs ?? deriveDurationMs(createdAt, finishedEvent?.timestamp);
    const checkpoints = session?.checkpoints ?? [];
    const artifacts = session?.artifacts ?? output?.artifacts ?? [];
    const messages = session ? this.requireAgentService().getSessionMessages(session) : [];

    return {
      ...(run ?? {}),
      runId: runId ?? '',
      sessionId: sessionId ?? '',
      threadId: run?.threadId ?? session?.threadId,
      agentId: run?.agentId ?? (session?.metadata?.agentId as string | undefined),
      agentSpecId: run?.agentSpecId ?? (session?.metadata?.agentSpecId as string | undefined),
      agentSpecRevision: run?.agentSpecRevision ?? (session?.metadata?.agentSpecRevision as string | undefined),
      agentSpec: run?.agentSpec ?? session?.metadata?.agentSpec,
      workflowId: run?.workflowId ?? (session?.metadata?.workflowId as string | undefined),
      source: run?.source ?? session?.source ?? 'agent',
      status: session?.status ?? run?.status ?? 'running',
      createdAt,
      updatedAt,
      finishedAt: run?.finishedAt ?? finishedEvent?.timestamp,
      durationMs,
      roundCount: run?.roundCount ?? countEvents(events, 'model_finished'),
      toolCallCount: run?.toolCallCount ?? countEvents(events, 'tool_call_requested'),
      artifactCount: artifacts.length,
      checkpointCount: checkpoints.length,
      pendingPermission: session?.pendingPermission ?? run?.pendingPermission ?? null,
      pendingHitl: session?.pendingHitl ?? run?.pendingHitl ?? null,
      stopReason: run?.stopReason ?? output?.stopReason,
      error: run?.error ?? getRunError(finishedEvent),
      outputPreview: run?.outputPreview ?? output?.content?.slice(0, 200),
      output,
      checkpoints,
      artifacts,
      workspace: session?.workspace ?? run?.workspace,
      messages,
      inputMessages: session?.messages ?? [],
      eventCount: events.length,
      metadata: {
        ...(run?.metadata ?? {}),
        ...(session?.metadata ?? {})
      }
    };
  }

  private buildSessionState(session: AgentSession) {
    return {
      sessionId: session.sessionId,
      runId: session.runId,
      threadId: session.threadId,
      source: session.source,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
      eventCount: session.events.length,
      checkpointCount: session.checkpoints.length,
      artifactCount: session.artifacts.length,
      pendingPermission: session.pendingPermission ?? null,
      pendingHitl: session.pendingHitl ?? null,
      workspace: session.workspace,
      workspaceState: session.workspaceState ?? null,
      output: session.output ?? null,
      metadata: session.metadata ?? {}
    };
  }

  private buildSessionGroupState(
    sessionId: string,
    sessions: AgentSession[],
    fallback: AgentSession
  ) {
    const sorted = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const lastSession = sorted.at(-1) ?? fallback;
    return {
      sessionId,
      threadId: lastSession.threadId ?? fallback.threadId,
      status: deriveThreadStatus(sorted.length > 0 ? sorted : [fallback]),
      runCount: sorted.length,
      runIds: sorted.map((session) => session.runId),
      createdAt: sorted[0]?.createdAt ?? fallback.createdAt,
      updatedAt: sorted.reduce(
        (latest, session) => (session.updatedAt > latest ? session.updatedAt : latest),
        fallback.updatedAt
      ),
      messageCount: sorted.reduce((total, session) => total + session.messages.length, 0),
      eventCount: sorted.reduce((total, session) => total + session.events.length, 0),
      checkpointCount: sorted.reduce((total, session) => total + session.checkpoints.length, 0),
      artifactCount: sorted.reduce((total, session) => total + session.artifacts.length, 0),
      pendingPermission: sorted.find((session) => session.pendingPermission)?.pendingPermission ?? null,
      pendingHitl: sorted.find((session) => session.pendingHitl)?.pendingHitl ?? null,
      lastRunId: lastSession.runId,
      workspaceState: lastSession.workspaceState ?? null,
      runs: sorted.map((session) => this.buildSessionState(session)),
      metadata: fallback.metadata ?? {}
    };
  }

  private buildMessagesResponse(session: AgentSession, messages: AgentMessage[]) {
    return {
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      messages
    };
  }

  private buildThreadState(threadId: string, sessions: AgentSession[]) {
    const sorted = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const lastSession = sorted.at(-1);
    return {
      threadId,
      status: deriveThreadStatus(sorted),
      sessionCount: new Set(sorted.map((session) => session.sessionId)).size,
      runCount: sorted.length,
      messageCount: sorted.reduce((total, session) => total + session.messages.length, 0),
      createdAt: sorted[0]?.createdAt,
      updatedAt: sorted.reduce(
        (latest, session) => (session.updatedAt > latest ? session.updatedAt : latest),
        sorted[0]?.updatedAt ?? new Date().toISOString()
      ),
      lastRunId: lastSession?.runId,
      lastSessionId: lastSession?.sessionId,
      sessions: sorted.map((session) => this.buildSessionState(session))
    };
  }

  private requireAgentService() {
    if (!this.context.agentService) {
      throw new AppError(503, 'Agent Service not initialized');
    }
    return this.context.agentService;
  }

  private async requireRunSession(runId: string): Promise<AgentSession> {
    const session = await this.requireAgentService().getRunSession(runId);
    if (!session) {
      throw new AppError(404, `Agent run not found: ${runId}`);
    }
    return session;
  }

  streamAiContent(
    prompt: string,
    systemInstruction?: string,
    config?: any,
    options?: { signal?: AbortSignal }
  ) {
    let provider = this.context.aiProvider;
    if (config) {
      const effectiveConfig = {
        ...config,
        model: config.model || (config.models && config.models[0])
      };
      const created = createAIProvider(effectiveConfig, this.context.proxyAgent);
      if (created) provider = created;
    }

    if (!provider || !provider.streamContent) {
      throw new Error('AI Provider not configured or does not support streaming');
    }

    return provider.streamContent(prompt, [], systemInstruction, options);
  }
}

function countEvents(events: AgentEvent[], type: AgentEvent['type']): number {
  return events.filter((event) => event.type === type).length;
}

function deriveDurationMs(createdAt?: string, finishedAt?: string): number | undefined {
  if (!createdAt || !finishedAt) return undefined;
  const start = new Date(createdAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return end - start;
}

function getRunError(event?: AgentEvent): string | undefined {
  if (event?.type !== 'run_failed') return undefined;
  return event.payload.error;
}

function normalizeRunOptions(options?: AgentApiRunOptions) {
  if (!options) return undefined;
  return {
    ...options,
    messages: normalizeMessages(options.messages),
    attachments: normalizeAttachments(options.attachments)
  };
}

function normalizeMessages(value: unknown): AIMessage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const messages = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (!isRuntimeMessageRole(record.role)) return [];
    return [
      {
        role: record.role,
        content: normalizeRuntimeMessageContent(record.content),
        name: typeof record.name === 'string' ? record.name : undefined,
        tool_call_id: typeof record.tool_call_id === 'string'
          ? record.tool_call_id
          : typeof record.toolCallId === 'string'
            ? record.toolCallId
            : undefined,
        tool_calls: Array.isArray(record.tool_calls)
          ? record.tool_calls
          : Array.isArray(record.toolCalls)
            ? record.toolCalls
            : undefined,
        raw_parts: Array.isArray(record.raw_parts)
          ? record.raw_parts
          : Array.isArray(record.rawParts)
            ? record.rawParts
            : undefined,
        canonical_message_version:
          typeof record.canonical_message_version === 'string'
            ? record.canonical_message_version
            : typeof record.canonicalMessageVersion === 'string'
              ? record.canonicalMessageVersion
              : undefined
      }
    ];
  });
  return messages.length > 0 ? messages : undefined;
}

function isRuntimeMessageRole(value: unknown): value is AIMessage['role'] {
  return value === 'system' || value === 'user' || value === 'assistant' || value === 'tool';
}

function normalizeRuntimeMessageContent(value: unknown): AIMessage['content'] {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value);
}

function normalizeAttachments(value: unknown): AgentRunSpec['input']['attachments'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id.trim()) return [];
    return [
      {
        id: record.id,
        name: typeof record.name === 'string' ? record.name : undefined,
        uri: typeof record.uri === 'string' ? record.uri : undefined,
        mimeType: typeof record.mimeType === 'string' ? record.mimeType : undefined,
        metadata:
          record.metadata && typeof record.metadata === 'object'
            ? { ...(record.metadata as Record<string, unknown>) }
            : undefined
      }
    ];
  });
  return attachments.length > 0 ? attachments : undefined;
}

async function readArtifactContent(artifact: AgentSession['artifacts'][number]): Promise<string | null> {
  const workspacePath =
    typeof artifact.metadata?.workspacePath === 'string' ? artifact.metadata.workspacePath : undefined;
  if (!workspacePath) return null;
  try {
    return await fs.readFile(workspacePath, 'utf8');
  } catch {
    return null;
  }
}

function normalizeHitlAction(value: unknown): AgentHitlAction | undefined {
  return typeof value === 'string' && isHitlAction(value) ? value : undefined;
}

function normalizeHitlKind(value: unknown): AgentHitlKind | undefined {
  return typeof value === 'string' && isHitlKind(value) ? value : undefined;
}

function isHitlAction(value: string): value is AgentHitlAction {
  return (
    value === 'allow' ||
    value === 'deny' ||
    value === 'edit_arguments' ||
    value === 'provide_input' ||
    value === 'external_result' ||
    value === 'cancel'
  );
}

function isHitlKind(value: string): value is AgentHitlKind {
  return (
    value === 'permission' ||
    value === 'confirmation' ||
    value === 'argument_edit' ||
    value === 'needs_input' ||
    value === 'external_execution'
  );
}

type HitlResolutionBody = {
  action: AgentHitlAction;
  kind?: AgentHitlKind;
  editedArguments?: unknown;
  input?: unknown;
  externalResult?: unknown;
};

function validateHitlResolutionBody(
  pendingHitl: AgentHitlRequest,
  body: HitlResolutionBody
): void {
  if (body.kind && body.kind !== pendingHitl.kind) {
    throw new AppError(400, `HITL kind does not match pending request: ${body.kind}`);
  }
  const allowed = new Set(pendingHitl.allowedActions ?? defaultHitlActionsForKind(pendingHitl.kind, pendingHitl));
  if (!allowed.has(body.action)) {
    throw new AppError(400, `HITL action is not allowed for pending request: ${body.action}`);
  }
  if (!defaultHitlActionsForKind(pendingHitl.kind, pendingHitl).includes(body.action)) {
    throw new AppError(400, `HITL action does not match request kind: ${pendingHitl.kind}/${body.action}`);
  }
  if (body.action === 'edit_arguments' && body.editedArguments === undefined) {
    throw new AppError(400, 'editedArguments is required for HITL edit_arguments');
  }
  if (body.action !== 'edit_arguments' && body.editedArguments !== undefined) {
    throw new AppError(400, 'editedArguments is only allowed for HITL edit_arguments');
  }
  if (body.action === 'provide_input' && body.input === undefined) {
    throw new AppError(400, 'input is required for HITL provide_input');
  }
  if (body.action !== 'provide_input' && body.input !== undefined) {
    throw new AppError(400, 'input is only allowed for HITL provide_input');
  }
  if (body.action === 'external_result' && body.externalResult === undefined) {
    throw new AppError(400, 'externalResult is required for HITL external_result');
  }
  if (body.action !== 'external_result' && body.externalResult !== undefined) {
    throw new AppError(400, 'externalResult is only allowed for HITL external_result');
  }
}

function defaultHitlActionsForKind(
  kind: AgentHitlKind,
  request?: AgentHitlRequest
): AgentHitlAction[] {
  switch (kind) {
    case 'permission':
    case 'argument_edit':
      return ['allow', 'deny', 'edit_arguments', 'cancel'];
    case 'confirmation':
      return request?.permissionId
        ? ['allow', 'deny', 'edit_arguments', 'cancel']
        : ['allow', 'deny', 'cancel'];
    case 'needs_input':
      return ['provide_input', 'cancel'];
    case 'external_execution':
      return ['external_result', 'cancel'];
  }
}

function isRunClosingEvent(type: AgentEvent['type']): boolean {
  return type === 'run_finished' || type === 'run_failed' || type === 'run_cancelled' || type === 'run_archived';
}

function seqOf(event: AgentEvent): number {
  return typeof event.sequence === 'number' && Number.isFinite(event.sequence) ? event.sequence : 0;
}

function extractMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  return JSON.stringify(content);
}

function deriveThreadStatus(sessions: AgentSession[]): AgentRun['status'] | 'empty' {
  if (sessions.length === 0) return 'empty';
  const statuses = sessions.map((session) => session.status);
  if (statuses.some((status) => status === 'running' || status === 'queued' || status === 'cancelling')) {
    return 'running';
  }
  if (statuses.some((status) => status === 'paused')) return 'paused';
  return sessions.at(-1)?.status ?? 'empty';
}

function sessionToRunSummary(session: AgentSession): AgentRun {
  return {
    runId: session.runId,
    sessionId: session.sessionId,
    threadId: session.threadId,
    agentId: session.metadata?.agentId as string | undefined,
    agentSpecId: session.metadata?.agentSpecId as string | undefined,
    agentSpecRevision: session.metadata?.agentSpecRevision as string | undefined,
    agentSpec: session.metadata?.agentSpec as AgentRun['agentSpec'],
    workflowId: session.metadata?.workflowId as string | undefined,
    source: session.source,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    roundCount: 0,
    toolCallCount: 0,
    artifactCount: session.artifacts.length,
    checkpointCount: session.checkpoints.length,
    pendingPermission: session.pendingPermission,
    pendingHitl: session.pendingHitl
  };
}

export interface PendingPermissionItem {
  kind: 'agent' | 'workflow';
  runId?: string;
  sessionId?: string;
  agentId?: string;
  workflowId?: string;
  workflowRunId?: string;
  workflowName?: string;
  stepId?: string;
  stepDisplayName?: string;
  permission: PermissionRequest;
  runStatus: AgentRun['status'];
  createdAt: string;
}

export interface PermissionHistoryItem {
  runId: string;
  sessionId: string;
  agentId?: string;
  permissionId: string;
  toolName?: string;
  effect: 'allow' | 'deny';
  reason?: string;
  resolvedBy?: string;
  requestedAt: string;
  resolvedAt: string;
  kind?: 'agent' | 'workflow';
  workflowId?: string;
  workflowRunId?: string;
  stepId?: string;
}
