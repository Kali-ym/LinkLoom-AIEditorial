import type {
  AgentDefinition,
  AgentExecutionResult,
  AgentToolObservation
} from '../../../types/agent.js';
import type { AIMessage } from '../../../types/index.js';
import { LogService } from '../../LogService.js';
import {
  ReActRuntime,
  type ReActRuntimeOptions,
  type ReActRuntimePermissionPauseState
} from '../runtime/ReActRuntime.js';
import type { ContextUsageSnapshot } from '../context/ContextTokenTypes.js';
import { buildProviderCacheMetadataPatch } from './responseContextCache.js';
import { readPromptCacheContract } from './promptCacheContract.js';
import type {
  AgentEngine,
  AgentHitlResumeOptions,
  AgentResumeOptions,
  AgentRunHandle,
  AgentRunOptions
} from './AgentEngine.js';
import type {
  AgentEvent,
  AgentEventListener,
  AgentHitlRequest,
  AgentHitlResolution
} from './AgentEvent.js';
import { normalizeAgentEvent } from './AgentEvent.js';
import {
  agentEventContextFromSpec,
  mapToolObservationToAgentEvents,
  mapStreamChunkToAgentEvents,
  mapTraceToAgentEvents
} from './AgentEventMapper.js';
import { createAgentEventLegacyStreamAdapter } from './AgentEventStreamAdapter.js';
import { AgentMiddlewareRunner } from './AgentMiddlewareRunner.js';
import type { AgentRunEventChannel } from './AgentRunEventChannel.js';
import type { AgentRunRegistry } from './AgentRunRegistry.js';
import type { AgentRunOutput, AgentRunSpec, AgentMessage, AgentRunStatus } from './AgentRunSpec.js';
import { runtimeMessageToAgentContent } from '../userTurnRuntime.js';
import {
  isArchivableRunStatus,
  isCancellableRunStatus,
  isClosedRunStatus,
  isExecutionLifecycleSuppressedStatus
} from './AgentRunStateMachine.js';
import type { AgentArtifactRef, AgentSession } from './AgentSession.js';
import { InMemoryAgentSessionStore, type AgentSessionStore } from './AgentSessionStore.js';
import type { ContextCompactionRecord } from './ContextManager.js';
import { AGENT_CONTEXT_BUILDER_VERSION } from '../context/AgentContextBuilder.js';
import { InMemoryAgentEventBus, type AgentEventBus } from './EventBus.js';
import { createPlatformPermissionPolicy, DefaultPermissionEngine } from './PermissionEngine.js';
import type { PermissionDecision, PermissionRequest } from './PermissionPolicy.js';
import { ASK_USER_QUESTION_TOOL_ID, type UserInputPauseRequest } from './UserInputEngine.js';
import { WorkspaceManager } from './WorkspaceManager.js';
import type { WorkspacePolicy, WorkspaceRef } from './WorkspacePolicy.js';
import { summarizeWorkspaceFromRef } from './WorkspacePolicyResolver.js';

export interface ReActAgentEngineRunOptions extends AgentRunOptions {
  runtimeOptions?: ReActRuntimeOptions;
}

export class ReActAgentEngine implements AgentEngine {
  private readonly permissionEngine = new DefaultPermissionEngine();
  private readonly workspaceManager: WorkspaceManager;
  private readonly streamEventStateByRunId = new Map<string, { requestedToolCalls: Set<string> }>();
  /** Monotonic counter for ephemeral stream events (not persisted, not on event bus). */
  private readonly ephemeralStreamSeqByRunId = new Map<string, number>();
  private readonly runControlsByRunId = new Map<
    string,
    { controller: AbortController; dispose?: () => void }
  >();

  constructor(
    private readonly eventBus: AgentEventBus = new InMemoryAgentEventBus(),
    private readonly sessionStore: AgentSessionStore = new InMemoryAgentSessionStore(),
    private readonly runRegistry?: AgentRunRegistry,
    private readonly eventChannel?: AgentRunEventChannel,
    workspaceManager?: WorkspaceManager
  ) {
    this.workspaceManager = workspaceManager ?? new WorkspaceManager();
  }

  async prepareRun(spec: AgentRunSpec): Promise<void> {
    await this.sessionStore.createSession(spec);
    await this.publishRunQueued(spec);
  }

  async run(spec: AgentRunSpec, options: ReActAgentEngineRunOptions = {}): Promise<AgentRunOutput> {
    const startedAt = Date.now();
    const metadata = {
      ...spec.metadata,
      ...options.metadata
    };
    const runSpec = {
      ...spec,
      metadata
    };
    const middleware = this.createMiddlewareRunner(runSpec, options, metadata);
    await this.sessionStore.createSession(runSpec);
    await this.ensureRunQueued(runSpec);
    if (await this.shouldSkipLifecycleEvent(runSpec.runId)) {
      return { content: '', stopReason: 'cancelled' };
    }
    const control = this.createRunControl(runSpec.runId, options.signal);
    if (control.controller.signal.aborted) {
      await this.cancelRun(runSpec.runId, this.getAbortReason(control.controller.signal));
      this.disposeRunControl(runSpec.runId, control);
      return { content: '', stopReason: 'cancelled' };
    }
    const workspaceResult = await this.workspaceManager.createWorkspace(runSpec).catch((error) => {
      this.disposeRunControl(runSpec.runId, control);
      throw error;
    });
    const workspace = workspaceResult.workspace;
    if (control.controller.signal.aborted || (await this.shouldSkipLifecycleEvent(runSpec.runId))) {
      if (control.controller.signal.aborted) {
        await this.cancelRun(runSpec.runId, this.getAbortReason(control.controller.signal));
      }
      await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
      this.disposeRunControl(runSpec.runId, control);
      return { content: '', stopReason: 'cancelled' };
    }
    if (workspace) {
      await this.sessionStore.updateWorkspace(runSpec.sessionId, workspace, runSpec.runId);
    }
    await this.publishRunStarted(runSpec, workspace, workspaceResult.policy);

    try {
      if (!options.runtimeOptions) {
        throw new Error('ReActAgentEngine.run requires runtimeOptions.');
      }

      await middleware.beforeRun();
      const runtimeOptions = this.withRuntimeControls(
        runSpec,
        { ...options.runtimeOptions, signal: control.controller.signal },
        workspace,
        middleware
      );
      const runtime = new ReActRuntime(runtimeOptions);
      const result = await runtime.run();
      await this.publishTraceEvents(runSpec, result);
      const output = this.toRunOutput(result);
      if (Object.keys(middleware.metadata).length > 0) {
        output.metadata = {
          ...output.metadata,
          middleware: middleware.metadata
        };
      }
      if (output.stopReason === 'permission_required' || output.stopReason === 'needs_input') {
        return output;
      }
      if (output.stopReason === 'cancelled') {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
        return output;
      }
      await middleware.beforeFinish(output);
      await this.persistProviderResponseCache(
        runSpec,
        runtime.getProviderResponseId(),
        runtimeOptions.agentDef
      );
      await this.publishRunFinished(runSpec, output, Date.now() - startedAt);
      await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'success');
      return output;
    } catch (error: any) {
      if (this.isCancellationError(error, control.controller.signal)) {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
        return { content: '', stopReason: 'cancelled' };
      }
      await middleware.onError(error);
      await this.publishRunFailed(runSpec, error, Date.now() - startedAt);
      await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
      throw error;
    } finally {
      this.disposeRunControl(runSpec.runId, control);
    }
  }

  async *streamChunks<T>(
    spec: AgentRunSpec,
    streamFactory: () => AsyncIterable<T>,
    options: AgentRunOptions = {}
  ): AsyncIterable<T> {
    const startedAt = Date.now();
    const metadata = {
      ...spec.metadata,
      ...options.metadata
    };
    const runSpec = {
      ...spec,
      metadata
    };
    const middleware = this.createMiddlewareRunner(runSpec, options, metadata);
    await this.sessionStore.createSession(runSpec);
    await this.ensureRunQueued(runSpec);
    if (await this.shouldSkipLifecycleEvent(runSpec.runId)) {
      return;
    }
    const control = this.createRunControl(runSpec.runId, options.signal);
    if (control.controller.signal.aborted) {
      await this.cancelRun(runSpec.runId, this.getAbortReason(control.controller.signal));
      this.disposeRunControl(runSpec.runId, control);
      return;
    }
    await this.publishRunStarted(runSpec);

    try {
      await middleware.beforeRun();
      for await (const chunk of streamFactory()) {
        if (control.controller.signal.aborted) {
          await this.publishRunCancelled(
            runSpec,
            this.getAbortReason(control.controller.signal),
            Date.now() - startedAt
          );
          this.streamEventStateByRunId.delete(runSpec.runId);
          return;
        }
        await this.applyStreamMiddlewareChunk(runSpec, middleware, chunk);
        await this.publishStreamChunkEvents(runSpec, chunk);
        yield chunk;
      }
      if (control.controller.signal.aborted) {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        this.streamEventStateByRunId.delete(runSpec.runId);
        return;
      }
      const output: AgentRunOutput = { content: '' };
      if (Object.keys(middleware.metadata).length > 0) {
        output.metadata = {
          middleware: middleware.metadata
        };
      }
      await middleware.beforeFinish(output);
      await this.publishRunFinished(runSpec, output, Date.now() - startedAt);
      this.streamEventStateByRunId.delete(runSpec.runId);
    } catch (error: any) {
      if (this.isCancellationError(error, control.controller.signal)) {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        this.streamEventStateByRunId.delete(runSpec.runId);
        return;
      }
      await middleware.onError(error);
      await this.publishRunFailed(runSpec, error, Date.now() - startedAt);
      this.streamEventStateByRunId.delete(runSpec.runId);
      throw error;
    } finally {
      this.disposeRunControl(runSpec.runId, control);
    }
  }

  async *streamRuntimeChunks(
    spec: AgentRunSpec,
    runtimeOptions: ReActRuntimeOptions,
    options: ReActAgentEngineRunOptions = {}
  ): AsyncIterable<any> {
    const startedAt = Date.now();
    const metadata = {
      ...spec.metadata,
      ...options.metadata
    };
    const runSpec = {
      ...spec,
      metadata
    };
    const middleware = this.createMiddlewareRunner(runSpec, options, metadata);
    await this.sessionStore.createSession(runSpec);
    await this.ensureRunQueued(runSpec);
    if (await this.shouldSkipLifecycleEvent(runSpec.runId)) {
      return;
    }
    const control = this.createRunControl(runSpec.runId, options.signal);
    if (control.controller.signal.aborted) {
      await this.cancelRun(runSpec.runId, this.getAbortReason(control.controller.signal));
      this.disposeRunControl(runSpec.runId, control);
      return;
    }
    const workspaceResult = await this.workspaceManager.createWorkspace(runSpec).catch((error) => {
      this.disposeRunControl(runSpec.runId, control);
      throw error;
    });
    const workspace = workspaceResult.workspace;
    if (control.controller.signal.aborted || (await this.shouldSkipLifecycleEvent(runSpec.runId))) {
      if (control.controller.signal.aborted) {
        await this.cancelRun(runSpec.runId, this.getAbortReason(control.controller.signal));
      }
      await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
      this.disposeRunControl(runSpec.runId, control);
      return;
    }
    if (workspace) {
      await this.sessionStore.updateWorkspace(runSpec.sessionId, workspace, runSpec.runId);
    }
    await this.publishRunStarted(runSpec, workspace, workspaceResult.policy);

    let finalContent = '';
    let stopReason: string | undefined;

    try {
      await middleware.beforeRun();
      const controlledRuntimeOptions = this.withRuntimeControls(
        runSpec,
        { ...runtimeOptions, signal: control.controller.signal },
        workspace,
        middleware
      );
      const legacyStreamAdapter = createAgentEventLegacyStreamAdapter();
      let eventCursor = this.eventBus.getEventCount(runSpec.runId);
      const runtime = new ReActRuntime(controlledRuntimeOptions);
      for await (const chunk of runtime.stream()) {
        this.accumulateStreamOutput(chunk, finalContent, (content, reason) => {
          finalContent = content;
          if (reason) stopReason = reason;
        });
        const pendingEvents = this.eventBus
          .getEventsFromIndex(runSpec.runId, eventCursor)
          .filter((event) => !isEphemeralStreamEvent(event));
        const events = await this.publishStreamChunkEvents(runSpec, chunk);
        for (const legacyChunk of legacyStreamAdapter.mapEvents([...pendingEvents, ...events])) {
          yield legacyChunk;
        }
        eventCursor = this.eventBus.getEventCount(runSpec.runId);
      }

      if (stopReason === 'permission_required' || stopReason === 'needs_input') {
        this.streamEventStateByRunId.delete(runSpec.runId);
        return;
      }

      if (stopReason === 'cancelled') {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
        this.streamEventStateByRunId.delete(runSpec.runId);
        return;
      }

      const output: AgentRunOutput = {
        content: finalContent,
        stopReason
      };
      if (Object.keys(middleware.metadata).length > 0) {
        output.metadata = {
          middleware: middleware.metadata
        };
      }
      await middleware.beforeFinish(output);
      await this.persistProviderResponseCache(
        runSpec,
        runtime.getProviderResponseId(),
        controlledRuntimeOptions.agentDef
      );
      await this.publishRunFinished(runSpec, output, Date.now() - startedAt);
      await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'success');
      this.streamEventStateByRunId.delete(runSpec.runId);
    } catch (error: any) {
      if (this.isCancellationError(error, control.controller.signal)) {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
        this.streamEventStateByRunId.delete(runSpec.runId);
        return;
      }
      await middleware.onError(error);
      await this.publishRunFailed(runSpec, error, Date.now() - startedAt);
      await this.cleanupWorkspaceIfNeeded(runSpec, workspaceResult.policy, workspace, 'failed');
      this.streamEventStateByRunId.delete(runSpec.runId);
      throw error;
    } finally {
      this.disposeRunControl(runSpec.runId, control);
    }
  }

  async stream(
    spec: AgentRunSpec,
    options: ReActAgentEngineRunOptions = {}
  ): Promise<AgentRunHandle> {
    const events = this.createEventStream(spec.runId);
    void this.run(spec, options);

    return {
      runId: spec.runId,
      sessionId: spec.sessionId,
      status: 'queued',
      events,
      abort: async (reason?: string) => {
        await this.cancelRun(spec.runId, reason);
      }
    };
  }

  async resume(sessionId: string, options: AgentResumeOptions = {}): Promise<AgentRunOutput> {
    const session = options.runId
      ? await this.sessionStore.getSessionByRunId(options.runId)
      : await this.sessionStore.getSession(sessionId);
    if (!session || session.sessionId !== sessionId) {
      throw new Error(
        options.runId
          ? `Agent run not found: ${options.runId}`
          : `Agent session not found: ${sessionId}`
      );
    }

    if (isExecutionLifecycleSuppressedStatus(session.status)) {
      return {
        content: '',
        stopReason: session.status === 'cancelled' ? 'cancelled' : 'resume_ignored',
        metadata: {
          ignoredStatus: session.status
        }
      };
    }

    const pendingPermission = session.pendingPermission;
    if (!pendingPermission) {
      throw new Error(`Agent session has no pending permission: ${sessionId}`);
    }

    if (!options.decision) {
      throw new Error(
        `AgentEngine.resume requires a permission decision for session: ${sessionId}`
      );
    }

    if (options.decision.permissionId !== pendingPermission.permissionId) {
      throw new Error(
        `Permission decision does not match pending permission: ${options.decision.permissionId}`
      );
    }

    const checkpoint = this.resolveCheckpoint(session, options.checkpointId);
    if (options.checkpointId && !checkpoint) {
      throw new Error(`Agent checkpoint not found: ${options.checkpointId}`);
    }
    const checkpointId = checkpoint?.checkpointId;
    await this.publishPermissionResolved(session, options.decision);
    await this.sessionStore.resolvePermission(sessionId, options.decision);

    const latestSession = await this.sessionStore.getSessionByRunId(session.runId);
    const terminalStatuses = new Set(['succeeded', 'failed', 'cancelled', 'archived']);
    if (!latestSession || terminalStatuses.has(latestSession.status)) {
      return {
        content: '',
        stopReason: latestSession?.status === 'cancelled' ? 'cancelled' : 'resume_ignored',
        metadata: {
          checkpointId,
          permissionId: options.decision.permissionId,
          ignoredStatus: latestSession?.status
        }
      };
    }

    const pauseState = this.readPermissionPauseState(checkpoint?.state);
    if (!options.runtimeOptions || !pauseState) {
      const output: AgentRunOutput = {
        content: `Permission decision recorded: ${options.decision.effect}`,
        stopReason: 'resume_pending_execution',
        metadata: {
          checkpointId,
          permissionId: options.decision.permissionId,
          resumeMode: 'decision_recorded'
        }
      };
      await this.sessionStore.updateOutput(sessionId, output, session.runId);
      return output;
    }

    const startedAt = Date.now();
    const control = this.createRunControl(session.runId, options.signal);
    if (control.controller.signal.aborted) {
      await this.cancelRun(session.runId, this.getAbortReason(control.controller.signal));
      this.disposeRunControl(session.runId, control);
      return { content: '', stopReason: 'cancelled' };
    }

    const runSpec = this.specFromSession(latestSession);
    const middleware = this.createMiddlewareRunner(runSpec, options, {
      ...runSpec.metadata,
      ...options.metadata
    });
    await this.publishRunResumed(latestSession, checkpointId);
    try {
      await middleware.beforeRun();
      const canStreamResume = typeof options.runtimeOptions?.provider?.streamContent === 'function';
      const runtimeOptions = this.withRuntimeControls(
        runSpec,
        {
          ...options.runtimeOptions!,
          agentDef: options.runtimeOptions!.agentDef,
          provider: options.runtimeOptions!.provider,
          signal: control.controller.signal,
          workspace: {
            ...options.runtimeOptions!.workspace,
            workspace: latestSession.workspace ?? options.runtimeOptions!.workspace?.workspace,
            policy: runSpec.workspacePolicy ?? options.runtimeOptions!.workspace?.policy
          },
          ...(canStreamResume
            ? {
                onStreamChunk: (chunk: unknown) => {
                  void this.publishStreamChunkEvents(runSpec, chunk);
                }
              }
            : {})
        },
        latestSession.workspace ?? options.runtimeOptions.workspace?.workspace,
        middleware
      );
      const result = await new ReActRuntime(runtimeOptions).resumeFromPermission({
        state: pauseState,
        decision: options.decision
      });
      if (!canStreamResume) {
        await this.publishTraceEvents(runSpec, result);
      }
      const output = this.toRunOutput(result);
      if (output.stopReason === 'cancelled') {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        return output;
      }
      if (output.stopReason === 'permission_required' || output.stopReason === 'needs_input') {
        return output;
      }
      await middleware.beforeFinish(output);
      if (Object.keys(middleware.metadata).length > 0) {
        output.metadata = {
          ...output.metadata,
          middleware: middleware.metadata
        };
      }
      await this.publishRunFinished(runSpec, output, Date.now() - startedAt);
      return output;
    } catch (error: any) {
      if (this.isCancellationError(error, control.controller.signal)) {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        return { content: '', stopReason: 'cancelled' };
      }
      await middleware.onError(error);
      await this.publishRunFailed(runSpec, error, Date.now() - startedAt);
      throw error;
    } finally {
      this.disposeRunControl(session.runId, control);
    }
  }

  async resumeHitl(sessionId: string, options: AgentHitlResumeOptions): Promise<AgentRunOutput> {
    const session = options.runId
      ? await this.sessionStore.getSessionByRunId(options.runId)
      : await this.sessionStore.getSession(sessionId);
    if (!session || session.sessionId !== sessionId) {
      throw new Error(
        options.runId
          ? `Agent run not found: ${options.runId}`
          : `Agent session not found: ${sessionId}`
      );
    }

    if (isExecutionLifecycleSuppressedStatus(session.status)) {
      return {
        content: '',
        stopReason: session.status === 'cancelled' ? 'cancelled' : 'resume_ignored',
        metadata: {
          ignoredStatus: session.status
        }
      };
    }

    const pendingHitl = session.pendingHitl;
    if (!pendingHitl) {
      throw new Error(`Agent session has no pending HITL request: ${sessionId}`);
    }
    if (pendingHitl.permissionId) {
      throw new Error(
        `Permission-backed HITL must be resumed through permission resolution: ${sessionId}`
      );
    }
    if (options.resolution.requestId !== pendingHitl.requestId) {
      throw new Error(
        `HITL resolution does not match pending request: ${options.resolution.requestId}`
      );
    }

    const checkpoint = this.resolveCheckpoint(
      session,
      options.checkpointId ?? pendingHitl.checkpointId
    );
    if (options.checkpointId && !checkpoint) {
      throw new Error(`Agent checkpoint not found: ${options.checkpointId}`);
    }
    const checkpointId = checkpoint?.checkpointId ?? pendingHitl.checkpointId;
    await this.publishHitlResolved(session, options.resolution);

    const latestSession = await this.sessionStore.getSessionByRunId(session.runId);
    if (!latestSession || isExecutionLifecycleSuppressedStatus(latestSession.status)) {
      return {
        content: '',
        stopReason: latestSession?.status === 'cancelled' ? 'cancelled' : 'resume_ignored',
        metadata: {
          checkpointId,
          requestId: options.resolution.requestId,
          ignoredStatus: latestSession?.status
        }
      };
    }

    if (options.resolution.action === 'cancel') {
      await this.publishRunCancelled(latestSession, 'manual');
      return {
        content: '',
        stopReason: 'cancelled',
        metadata: {
          checkpointId,
          requestId: options.resolution.requestId
        }
      };
    }

    const userInputPauseState = this.readPermissionPauseState(checkpoint?.state);
    const isAskUserQuestionResume =
      pendingHitl.kind === 'needs_input' &&
      pendingHitl.metadata?.sourceKind === ASK_USER_QUESTION_TOOL_ID &&
      options.resolution.action === 'provide_input' &&
      Boolean(userInputPauseState && options.runtimeOptions);

    if (isAskUserQuestionResume && userInputPauseState) {
      const startedAt = Date.now();
      const control = this.createRunControl(session.runId, options.signal);
      if (control.controller.signal.aborted) {
        await this.cancelRun(session.runId, this.getAbortReason(control.controller.signal));
        this.disposeRunControl(session.runId, control);
        return { content: '', stopReason: 'cancelled' };
      }

      const runSpec = this.specFromSession(latestSession);
      const middleware = this.createMiddlewareRunner(runSpec, options, {
        ...runSpec.metadata,
        ...options.metadata
      });
      await this.publishRunResumed(latestSession, checkpointId);
      try {
        await middleware.beforeRun();
        const canStreamResume =
          typeof options.runtimeOptions?.provider?.streamContent === 'function';
        const runtimeOptions = this.withRuntimeControls(
          runSpec,
          {
            ...options.runtimeOptions!,
            agentDef: options.runtimeOptions!.agentDef,
            provider: options.runtimeOptions!.provider,
            signal: control.controller.signal,
            workspace: {
              ...options.runtimeOptions!.workspace,
              workspace: latestSession.workspace ?? options.runtimeOptions!.workspace?.workspace,
              policy: runSpec.workspacePolicy ?? options.runtimeOptions!.workspace?.policy
            },
            ...(canStreamResume
              ? {
                  onStreamChunk: (chunk: unknown) => {
                    void this.publishStreamChunkEvents(runSpec, chunk);
                  }
                }
              : {})
          },
          latestSession.workspace ?? options.runtimeOptions!.workspace?.workspace,
          middleware
        );
        const result = await new ReActRuntime(runtimeOptions).resumeFromUserInput({
          state: userInputPauseState,
          resolution: {
            action: 'provide_input',
            requestId: options.resolution.requestId,
            input: options.resolution.input,
            reason: options.resolution.reason
          }
        });
        if (!canStreamResume) {
          await this.publishTraceEvents(runSpec, result);
        }
        const output = this.toRunOutput(result);
        if (output.stopReason === 'cancelled') {
          await this.publishRunCancelled(
            runSpec,
            this.getAbortReason(control.controller.signal),
            Date.now() - startedAt
          );
          return output;
        }
        if (output.stopReason === 'permission_required' || output.stopReason === 'needs_input') {
          return output;
        }
        await middleware.beforeFinish(output);
        if (Object.keys(middleware.metadata).length > 0) {
          output.metadata = {
            ...output.metadata,
            middleware: middleware.metadata
          };
        }
        await this.publishRunFinished(runSpec, output, Date.now() - startedAt);
        return output;
      } catch (error: any) {
        if (this.isCancellationError(error, control.controller.signal)) {
          await this.publishRunCancelled(
            runSpec,
            this.getAbortReason(control.controller.signal),
            Date.now() - startedAt
          );
          return { content: '', stopReason: 'cancelled' };
        }
        await middleware.onError(error);
        await this.publishRunFailed(runSpec, error, Date.now() - startedAt);
        throw error;
      } finally {
        this.disposeRunControl(session.runId, control);
      }
    }

    const hitlMessages = this.toHitlResumeMessages(pendingHitl, options.resolution);
    const resumeSession =
      hitlMessages.length > 0
        ? await this.saveHitlResumeMessages(latestSession, hitlMessages)
        : latestSession;
    if (!options.runtimeOptions || hitlMessages.length === 0) {
      const output: AgentRunOutput = {
        content: `HITL decision recorded: ${options.resolution.action}`,
        stopReason: 'resume_pending_execution',
        metadata: {
          checkpointId,
          requestId: options.resolution.requestId,
          action: options.resolution.action,
          resumeMode: 'decision_recorded'
        }
      };
      await this.sessionStore.updateOutput(sessionId, output, session.runId);
      return output;
    }

    const startedAt = Date.now();
    const control = this.createRunControl(session.runId, options.signal);
    if (control.controller.signal.aborted) {
      await this.cancelRun(session.runId, this.getAbortReason(control.controller.signal));
      this.disposeRunControl(session.runId, control);
      return { content: '', stopReason: 'cancelled' };
    }

    const runSpec = this.specFromSession(resumeSession);
    const middleware = this.createMiddlewareRunner(runSpec, options, {
      ...runSpec.metadata,
      ...options.metadata
    });
    await this.publishRunResumed(resumeSession, checkpointId);
    try {
      await middleware.beforeRun();
      const runtimeOptions = this.withRuntimeControls(
        runSpec,
        {
          ...options.runtimeOptions,
          messages: [...options.runtimeOptions.messages, ...hitlMessages],
          signal: control.controller.signal,
          workspace: {
            ...options.runtimeOptions.workspace,
            workspace: resumeSession.workspace ?? options.runtimeOptions.workspace?.workspace,
            policy: runSpec.workspacePolicy ?? options.runtimeOptions.workspace?.policy
          }
        },
        resumeSession.workspace ?? options.runtimeOptions.workspace?.workspace,
        middleware
      );
      const runtime = new ReActRuntime(runtimeOptions);
      const result = await runtime.run();
      await this.publishTraceEvents(runSpec, result);
      const output = this.toRunOutput(result);
      if (output.stopReason === 'cancelled') {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        return output;
      }
      if (output.stopReason === 'permission_required' || output.stopReason === 'needs_input') {
        return output;
      }
      await middleware.beforeFinish(output);
      if (Object.keys(middleware.metadata).length > 0) {
        output.metadata = {
          ...output.metadata,
          middleware: middleware.metadata
        };
      }
      await this.publishRunFinished(runSpec, output, Date.now() - startedAt);
      return output;
    } catch (error: any) {
      if (this.isCancellationError(error, control.controller.signal)) {
        await this.publishRunCancelled(
          runSpec,
          this.getAbortReason(control.controller.signal),
          Date.now() - startedAt
        );
        return { content: '', stopReason: 'cancelled' };
      }
      await middleware.onError(error);
      await this.publishRunFailed(runSpec, error, Date.now() - startedAt);
      throw error;
    } finally {
      this.disposeRunControl(session.runId, control);
    }
  }

  async getSession(sessionId: string): Promise<AgentSession | null> {
    return this.sessionStore.getSession(sessionId);
  }

  async getSessionByRunId(runId: string): Promise<AgentSession | null> {
    return this.sessionStore.getSessionByRunId(runId);
  }

  async getSessionsBySessionId(sessionId: string): Promise<AgentSession[]> {
    return this.sessionStore.getSessionsBySessionId(sessionId);
  }

  async getSessionsByThreadId(threadId: string): Promise<AgentSession[]> {
    return this.sessionStore.getSessionsByThreadId(threadId);
  }

  async listSessions(): Promise<AgentSession[]> {
    return this.sessionStore.listSessions();
  }

  /** Persist a session back to the store. Used by manual context compaction
   *  to write the trimmed message list without launching a new run. */
  async saveSession(session: AgentSession): Promise<void> {
    await this.sessionStore.saveSession(session);
  }

  async cancelRun(runId: string, reason = 'manual'): Promise<{ status: AgentRunStatus }> {
    const session = await this.sessionStore.getSessionByRunId(runId);
    if (!session) {
      throw new Error(`Agent run not found: ${runId}`);
    }

    if (isClosedRunStatus(session.status)) {
      return { status: session.status };
    }

    if (session.status === 'cancelling') {
      return { status: 'cancelling' };
    }

    const cancelReason = isCancelReason(reason) ? reason : 'manual';
    await this.publishRunCancelRequested(session, cancelReason);

    const control = this.runControlsByRunId.get(runId);
    if (control && !control.controller.signal.aborted) {
      control.controller.abort(cancelReason);
      return { status: 'cancelling' };
    }

    await this.publishRunCancelled(session, cancelReason);
    return { status: 'cancelled' };
  }

  async archiveRun(runId: string, reason?: string): Promise<{ status: AgentRunStatus }> {
    const session = await this.sessionStore.getSessionByRunId(runId);
    if (!session) {
      throw new Error(`Agent run not found: ${runId}`);
    }

    if (session.status === 'archived') {
      return { status: 'archived' };
    }

    if (!isArchivableRunStatus(session.status)) {
      throw new Error(`Only terminal runs can be archived (current: ${session.status})`);
    }

    await this.publishEvent({
      id: this.createEventId(session.runId, 'run_archived'),
      type: 'run_archived',
      runId: session.runId,
      sessionId: session.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'archived',
        previousStatus: session.status,
        reason
      }
    });
    return { status: 'archived' };
  }

  async saveRunSession(session: AgentSession): Promise<void> {
    await this.sessionStore.saveSession(session);
  }

  async getEvents(runId: string): Promise<AgentEvent[]> {
    const session = await this.sessionStore.getSessionByRunId(runId);
    if (session) return session.events;

    return this.eventBus.getEvents(runId);
  }

  /** In-memory bus events for a run, including ephemeral live stream deltas. */
  getLiveEvents(runId: string): AgentEvent[] {
    return this.eventBus.getEvents(runId);
  }

  /**
   * Read persisted events for a run strictly after `afterSeq`, ordered by sequence.
   * Backs the cross-process SSE "NOTIFY wake -> incremental pull" loop and last-seq
   * resume. Falls back to the in-process bus when no table-backed session store exists.
   */
  async getEventsAfter(runId: string, afterSeq: number): Promise<AgentEvent[]> {
    const repos = this.sessionStore as {
      storeRepositories?: () =>
        | {
            agentEvents?: {
              listByRun: (runId: string, afterSeq?: number) => Promise<AgentEvent[]>;
            };
          }
        | undefined;
    };
    const tableRepos =
      typeof repos.storeRepositories === 'function' ? repos.storeRepositories() : undefined;
    if (tableRepos?.agentEvents) {
      return tableRepos.agentEvents.listByRun(runId, afterSeq);
    }
    const all = await this.getEvents(runId);
    return all.filter((event) => typeof event.sequence === 'number' && event.sequence > afterSeq);
  }

  getEventChannel(): AgentRunEventChannel | undefined {
    return this.eventChannel;
  }

  async recordExternalEvent(event: AgentEvent): Promise<void> {
    await this.publishEvent(event);
  }

  subscribe(runId: string, listener: AgentEventListener): () => void {
    return this.eventBus.subscribe(runId, listener);
  }

  private toRunOutput(result: AgentExecutionResult): AgentRunOutput {
    return {
      content: result.content,
      data: result.data,
      usage: result.usage,
      stopReason: result.stopReason,
      toolCalls: result.toolCalls,
      trace: result.trace
    };
  }

  private async persistProviderResponseCache(
    runSpec: AgentRunSpec,
    responseId: string | undefined,
    agentDef?: AgentDefinition
  ): Promise<void> {
    if (!responseId || !agentDef?.model || !agentDef.providerId) return;
    const session = await this.sessionStore.getSessionByRunId(runSpec.runId);
    if (!session) return;

    const contract = readPromptCacheContract(session.metadata?.promptCacheContract);
    session.metadata = {
      ...session.metadata,
      ...buildProviderCacheMetadataPatch({
        responseId,
        contract,
        agentModel: agentDef.model,
        agentProviderId: agentDef.providerId
      })
    };
    await this.sessionStore.saveSession(session);
  }

  private createMiddlewareRunner(
    spec: AgentRunSpec,
    options: AgentRunOptions,
    metadata: Record<string, unknown>
  ): AgentMiddlewareRunner {
    return new AgentMiddlewareRunner(options.middleware, {
      spec,
      metadata,
      emit: (event) => this.publishEvent(event)
    });
  }

  private accumulateStreamOutput(
    chunk: unknown,
    currentContent: string,
    onUpdate: (content: string, reason?: string) => void
  ): void {
    if (!chunk || typeof chunk !== 'object') return;

    const payload = chunk as Record<string, unknown>;
    if (payload.type === 'content' && typeof payload.content === 'string') {
      onUpdate(currentContent + payload.content);
      return;
    }
    if (payload.type === 'final_content' && typeof payload.content === 'string') {
      onUpdate(payload.content);
      return;
    }
    if (payload.type === 'final_trace' && typeof payload.stopReason === 'string') {
      onUpdate(currentContent, payload.stopReason);
    }
  }

  private async applyStreamMiddlewareChunk(
    spec: AgentRunSpec,
    middleware: AgentMiddlewareRunner,
    chunk: unknown
  ): Promise<void> {
    if (!chunk || typeof chunk !== 'object') return;

    const payload = chunk as Record<string, any>;
    if (payload.type === 'round_start') {
      await middleware.beforeModelCall({
        messages: spec.input.messages ?? [],
        providerId: spec.agentDef?.providerId || spec.temporaryAgentDef?.providerId,
        model: spec.agentDef?.model || spec.temporaryAgentDef?.model
      });
      return;
    }

    if (payload.type === 'final_content' || payload.type === 'final_trace') {
      await middleware.afterModelCall({
        messages: spec.input.messages ?? [],
        providerId: spec.agentDef?.providerId || spec.temporaryAgentDef?.providerId,
        model: spec.agentDef?.model || spec.temporaryAgentDef?.model,
        result: payload
      });
      return;
    }

    if (payload.type === 'tool_start') {
      await middleware.beforeToolCall({
        toolName: String(payload.tool || ''),
        arguments: payload.args
      });
      return;
    }

    if (payload.type === 'tool_result' || payload.type === 'tool_error') {
      await middleware.afterToolCall({
        toolName: String(payload.tool || ''),
        arguments: undefined,
        result:
          payload.type === 'tool_result' ? payload.result : { success: false, error: payload.error }
      });
    }
  }

  private withRuntimeControls(
    spec: AgentRunSpec,
    runtimeOptions: ReActRuntimeOptions,
    workspace?: WorkspaceRef,
    middleware?: AgentMiddlewareRunner
  ): ReActRuntimeOptions {
    const policy = spec.permissionPolicy ?? createPlatformPermissionPolicy();
    const workspacePolicy = spec.workspacePolicy ?? runtimeOptions.workspace?.policy;
    return {
      ...runtimeOptions,
      middleware: middleware
        ? {
            beforeModelCall: (input) => middleware.beforeModelCall(input),
            afterModelCall: (input) => middleware.afterModelCall(input),
            beforeToolCall: (input) => middleware.beforeToolCall(input),
            afterToolCall: (input) => middleware.afterToolCall(input)
          }
        : runtimeOptions.middleware,
      permission: {
        runId: spec.runId,
        sessionId: spec.sessionId,
        policy,
        decide: (input) =>
          this.permissionEngine.decide({
            runId: spec.runId,
            sessionId: spec.sessionId,
            policy,
            subject: {
              toolName: input.toolName,
              exposedName: input.exposedName,
              originalName: input.originalName,
              mcpServerId: input.mcpServerId
            },
            arguments: input.arguments,
            metadata: {
              source: spec.source,
              agentId: spec.agentDef?.id || spec.temporaryAgentDef?.id,
              toolCallId: input.toolCallId
            }
          }),
        onPermissionRequired: async (request, state) => {
          if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
          await this.publishPermissionRequired(spec, request);
          if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
          const checkpointId = await this.savePermissionCheckpoint(
            spec,
            request,
            {
              ...runtimeOptions,
              workspace: {
                ...runtimeOptions.workspace,
                workspace
              }
            },
            state
          );
          if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
          await this.publishRunPaused(spec, request.permissionId, checkpointId);
        },
        onPermissionResolved: async (decision) => {
          await this.publishPermissionResolved(spec, decision);
        }
      },
      userInput: {
        onUserInputRequired: async (request, state) => {
          if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
          await this.publishHitlRequired(spec, this.hitlRequestFromUserInput(request));
          if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
          const checkpointId = await this.saveUserInputCheckpoint(
            spec,
            request,
            {
              ...runtimeOptions,
              workspace: {
                ...runtimeOptions.workspace,
                workspace
              }
            },
            state
          );
          if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
          await this.publishUserInputPaused(spec, request.requestId, checkpointId);
        }
      },
      context: {
        ...runtimeOptions.context,
        runId: spec.runId,
        sessionId: spec.sessionId,
        policy: spec.contextPolicy ?? runtimeOptions.context?.policy,
        onContextCompacted: async (record) => {
          await runtimeOptions.context?.onContextCompacted?.(record);
          try {
            await this.saveContextCompactionCheckpoint(spec, runtimeOptions, record);
          } catch (error) {
            LogService.warn(
              `[ReActAgentEngine] Failed to persist context compaction checkpoint for ${spec.runId}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
          await this.publishContextCompacted(spec, record);
        },
        onArtifactSaved: async (artifact, content) => {
          const savedArtifact = await this.workspaceManager.saveArtifact(
            workspace,
            artifact,
            content
          );
          await runtimeOptions.context?.onArtifactSaved?.(savedArtifact, content);
          await this.sessionStore.saveArtifact(spec.sessionId, savedArtifact, spec.runId);
          await this.publishArtifactSaved(spec, savedArtifact);
        }
      },
      workspace: {
        ...runtimeOptions.workspace,
        workspace,
        policy: workspacePolicy
      },
      budgetPolicy: spec.budgetPolicy ?? runtimeOptions.budgetPolicy,
      observationPolicy: spec.observationPolicy ?? runtimeOptions.observationPolicy,
      tokenCounter: runtimeOptions.tokenCounter,
      classifiedMessageBuilder: runtimeOptions.classifiedMessageBuilder,
      onToolObservation: async (observation, round) => {
        await this.publishToolObservation(spec, observation, round);
        await runtimeOptions.onToolObservation?.(observation, round);
      },
      onContextUsageMeasured: async (snapshot, round) => {
        await runtimeOptions.onContextUsageMeasured?.(snapshot, round);
        await this.publishContextUsagePreview(spec, snapshot, round);
      }
    };
  }

  private async publishTraceEvents(
    spec: AgentRunSpec,
    result: AgentExecutionResult
  ): Promise<void> {
    const sequenceStart = await this.nextRunEventSequence(spec.runId);
    const events = mapTraceToAgentEvents(result.trace, {
      ...agentEventContextFromSpec(spec, { adapter: 'react-runtime-trace' }),
      sequenceStart
    });
    const deduped = this.dedupeTraceRepublicationEvents(spec.runId, events);
    for (const event of deduped) {
      await this.publishEvent(event);
    }
  }

  private async publishToolObservation(
    spec: AgentRunSpec,
    observation: AgentToolObservation,
    round: number
  ): Promise<void> {
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
    const sequenceStart = await this.nextRunEventSequence(spec.runId);
    const events = mapToolObservationToAgentEvents(observation, round, {
      ...agentEventContextFromSpec(spec, {
        adapter: 'react-runtime-tool-observation'
      }),
      sequenceStart
    });
    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  /** Skip tool_call_requested already emitted during the live stream (permission resume replays trace). */
  private dedupeTraceRepublicationEvents(runId: string, events: AgentEvent[]): AgentEvent[] {
    const requestedToolCallIds = new Set<string>();
    const completedToolCallIds = new Set<string>();
    for (const event of this.eventBus.getEvents(runId)) {
      const payload =
        event.payload && typeof event.payload === 'object'
          ? (event.payload as Record<string, unknown>)
          : {};
      if (event.type === 'tool_finished' || event.type === 'observation_added') {
        const completedToolCallId =
          typeof payload.toolCallId === 'string' ? payload.toolCallId : '';
        if (completedToolCallId) completedToolCallIds.add(completedToolCallId);
        continue;
      }
      if (event.type !== 'tool_call_requested') continue;
      const toolCallId = (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;
      if (toolCallId) requestedToolCallIds.add(toolCallId);
    }

    const seenInBatch = new Set<string>();
    return events.filter((event) => {
      const payload =
        event.payload && typeof event.payload === 'object'
          ? (event.payload as Record<string, unknown>)
          : {};
      if (event.type === 'tool_finished' || event.type === 'observation_added') {
        const toolCallId = typeof payload.toolCallId === 'string' ? payload.toolCallId : '';
        if (!toolCallId) return true;
        if (completedToolCallIds.has(toolCallId)) return false;
        completedToolCallIds.add(toolCallId);
        return true;
      }
      if (event.type !== 'tool_call_requested') return true;
      const toolCallId = (typeof payload.toolCallId === 'string' && payload.toolCallId) || event.id;
      if (!toolCallId) return true;
      if (requestedToolCallIds.has(toolCallId) || seenInBatch.has(toolCallId)) return false;
      seenInBatch.add(toolCallId);
      return true;
    });
  }

  private async publishStreamChunkEvents(
    spec: AgentRunSpec,
    chunk: unknown
  ): Promise<AgentEvent[]> {
    const mappedEvents = mapStreamChunkToAgentEvents(chunk, {
      ...agentEventContextFromSpec(spec, {
        adapter: 'legacy-stream-chunk',
        providerId: spec.agentDef?.providerId || spec.temporaryAgentDef?.providerId,
        model: spec.agentDef?.model || spec.temporaryAgentDef?.model,
        sequenceStart: 1
      }),
      sequenceStart: 1
    });
    const deduped = this.dedupeStreamChunkEvents(spec, mappedEvents);
    const output: AgentEvent[] = [];

    // Publish in original event order (not ephemeral-first then persisted).
    // If ephemeral deltas were published before the same chunk's persisted
    // tool_call_requested finished its DB write, the SSE subscriber would wake
    // on the delta, yield it, then a later chunk's delta could land in the bus
    // before this chunk's persisted event — scrambling the live UI order.
    for (const event of deduped) {
      if (isEphemeralStreamEvent(event)) {
        const seq = -((this.ephemeralStreamSeqByRunId.get(spec.runId) ?? 0) + 1);
        this.ephemeralStreamSeqByRunId.set(spec.runId, -seq);
        const liveEvent = normalizeAgentEvent({
          ...event,
          id: `${spec.runId}:stream:${event.type}:${-seq}`,
          sequence: seq
        });
        await this.publishLiveStreamEvent(liveEvent);
        output.push(liveEvent);
      } else {
        const sequenceStart = await this.nextRunEventSequence(spec.runId);
        const prepared = normalizeAgentEvent({
          ...event,
          id: `${spec.runId}:${event.type}:${sequenceStart}`,
          sequence: sequenceStart
        });
        await this.publishPreparedEvent(prepared);
        output.push(prepared);
      }
    }

    return output;
  }

  private dedupeStreamChunkEvents(spec: AgentRunSpec, events: AgentEvent[]): AgentEvent[] {
    let state = this.streamEventStateByRunId.get(spec.runId);
    if (!state) {
      state = { requestedToolCalls: new Set() };
      this.streamEventStateByRunId.set(spec.runId, state);
    }
    const skippedToolCalls = new Set<string>();
    const persistedCompletedToolCalls = new Set<string>();
    for (const persistedEvent of this.eventBus.getEvents(spec.runId)) {
      if (persistedEvent.type !== 'tool_finished' && persistedEvent.type !== 'observation_added') {
        continue;
      }
      const payload =
        persistedEvent.payload && typeof persistedEvent.payload === 'object'
          ? (persistedEvent.payload as Record<string, unknown>)
          : {};
      if (typeof payload.toolCallId === 'string' && payload.toolCallId) {
        persistedCompletedToolCalls.add(payload.toolCallId);
      }
    }
    return events.filter((event) => {
      if (event.type === 'tool_finished' || event.type === 'observation_added') {
        const payload =
          event.payload && typeof event.payload === 'object'
            ? (event.payload as Record<string, unknown>)
            : {};
        const toolCallId = typeof payload.toolCallId === 'string' ? payload.toolCallId : '';
        return !toolCallId || !persistedCompletedToolCalls.has(toolCallId);
      }
      if (event.type === 'tool_call_requested') {
        const key = this.toolCallRequestEventKey(event);
        if (!key) return true;
        if (state.requestedToolCalls.has(key)) {
          skippedToolCalls.add(key);
          return false;
        }
        state.requestedToolCalls.add(key);
        return true;
      }

      if (event.type === 'tool_call_validated') {
        const key = this.toolCallValidationEventKey(event);
        return !key || !skippedToolCalls.has(key);
      }

      return true;
    });
  }

  private toolCallRequestEventKey(event: AgentEvent): string | null {
    const payload =
      event.payload && typeof event.payload === 'object'
        ? (event.payload as Record<string, unknown>)
        : {};
    return this.toolCallEventKeyFromPayload(payload, 'arguments');
  }

  private toolCallValidationEventKey(event: AgentEvent): string | null {
    const payload =
      event.payload && typeof event.payload === 'object'
        ? (event.payload as Record<string, unknown>)
        : {};
    return this.toolCallEventKeyFromPayload(payload, 'normalizedArguments');
  }

  private toolCallEventKeyFromPayload(
    payload: Record<string, unknown>,
    argumentsField: 'arguments' | 'normalizedArguments'
  ): string | null {
    const requestKey = String(payload.requestKey || '').trim();
    if (requestKey) return `request:${requestKey}`;
    const toolCallId = String(payload.toolCallId || '').trim();
    if (toolCallId) return `id:${toolCallId}`;
    const toolName = String(payload.toolName || '').trim();
    if (!toolName) return null;
    const round = typeof payload.round === 'number' ? payload.round : 'unknown';
    const argsKey = this.stableEventPayloadKey(payload[argumentsField]);
    return `fallback:${round}:${toolName}:${argsKey}`;
  }

  private stableEventPayloadKey(value: unknown): string {
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return String(value);
    }
  }

  private async publishPermissionRequired(
    spec: AgentRunSpec,
    request: PermissionRequest
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'permission_required'),
      type: 'permission_required',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: request
    });
    await this.publishHitlRequired(spec, this.hitlRequestFromPermission(request));
  }

  private async publishPermissionResolved(
    target: { runId: string; sessionId: string },
    decision: PermissionDecision
  ): Promise<void> {
    const sessionBeforeResolution = await this.sessionStore.getSession(target.sessionId);
    const pending = sessionBeforeResolution?.pendingPermission;
    const enrichedDecision: PermissionDecision = {
      ...decision,
      metadata: {
        ...decision.metadata,
        toolCallId:
          (typeof decision.metadata?.toolCallId === 'string'
            ? decision.metadata.toolCallId
            : undefined) ??
          (typeof pending?.metadata?.toolCallId === 'string'
            ? pending.metadata.toolCallId
            : undefined)
      }
    };
    await this.publishEvent({
      id: this.createEventId(target.runId, 'permission_resolved'),
      type: 'permission_resolved',
      runId: target.runId,
      sessionId: target.sessionId,
      timestamp: new Date().toISOString(),
      payload: enrichedDecision
    });
    const hadPendingHitl =
      sessionBeforeResolution?.pendingHitl?.permissionId === decision.permissionId;
    if (decision.effect !== 'ask' && (hadPendingHitl || decision.resolvedBy === 'human')) {
      await this.publishHitlResolved(target, this.hitlResolutionFromPermission(decision));
    }
  }

  private async publishHitlRequired(
    target: { runId: string; sessionId: string },
    request: AgentHitlRequest
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(target.runId, 'hitl_required'),
      type: 'hitl_required',
      runId: target.runId,
      sessionId: target.sessionId,
      timestamp: request.createdAt ?? new Date().toISOString(),
      payload: request
    });
  }

  private async publishHitlResolved(
    target: { runId: string; sessionId: string },
    resolution: AgentHitlResolution
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(target.runId, 'hitl_resolved'),
      type: 'hitl_resolved',
      runId: target.runId,
      sessionId: target.sessionId,
      timestamp: resolution.resolvedAt ?? new Date().toISOString(),
      payload: resolution
    });
  }

  private hitlRequestFromPermission(request: PermissionRequest): AgentHitlRequest {
    return {
      requestId: request.permissionId,
      kind: 'confirmation',
      status: 'pending',
      prompt: request.reason || `Approve tool call: ${request.subject.toolName}`,
      proposedArguments: request.arguments,
      allowedActions: ['allow', 'deny', 'edit_arguments', 'cancel'],
      permissionId: request.permissionId,
      createdAt: request.requestedAt,
      expiresAt: request.expiresAt,
      metadata: {
        ...request.metadata,
        sourceKind: 'permission',
        subject: request.subject
      }
    };
  }

  private hitlRequestFromUserInput(request: UserInputPauseRequest): AgentHitlRequest {
    return {
      requestId: request.requestId,
      kind: 'needs_input',
      status: 'pending',
      prompt: request.prompt,
      proposedArguments: request.arguments,
      allowedActions: ['provide_input', 'cancel'],
      createdAt: request.requestedAt,
      metadata: {
        ...request.metadata,
        sourceKind: ASK_USER_QUESTION_TOOL_ID,
        toolCallId: request.toolCallId,
        toolName: request.toolName,
        exposedName: request.exposedName
      }
    };
  }

  private hitlResolutionFromPermission(decision: PermissionDecision): AgentHitlResolution {
    const edited = decision.editedArguments !== undefined;
    return {
      requestId: decision.permissionId,
      kind: 'confirmation',
      status: 'resolved',
      action: edited ? 'edit_arguments' : decision.effect === 'allow' ? 'allow' : 'deny',
      editedArguments: decision.editedArguments,
      reason: decision.reason,
      resolvedAt: decision.resolvedAt,
      resolvedBy: decision.resolvedBy
        ? {
            type: decision.resolvedBy === 'human' ? 'user' : 'system'
          }
        : undefined,
      metadata: {
        ...decision.metadata,
        sourceKind: 'permission',
        permissionEffect: decision.effect
      }
    };
  }

  private toHitlResumeMessages(
    request: AgentHitlRequest,
    resolution: AgentHitlResolution
  ): AIMessage[] {
    if (resolution.action === 'provide_input') {
      return [
        {
          role: 'user',
          content: this.stringifyHitlResumePayload({
            type: 'hitl_input',
            requestId: resolution.requestId,
            kind: resolution.kind,
            prompt: request.prompt,
            input: resolution.input,
            reason: resolution.reason
          })
        }
      ];
    }

    if (resolution.action === 'external_result') {
      const metadata = { ...(request.metadata ?? {}), ...(resolution.metadata ?? {}) };
      const toolCallId = typeof metadata.toolCallId === 'string' ? metadata.toolCallId : undefined;
      const toolName = typeof metadata.toolName === 'string' ? metadata.toolName : undefined;
      if (toolCallId && toolName) {
        return [
          {
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: this.stringifyHitlResumePayload({
              type: 'hitl_external_result',
              requestId: resolution.requestId,
              kind: resolution.kind,
              result: resolution.externalResult,
              reason: resolution.reason
            })
          }
        ];
      }
      return [
        {
          role: 'user',
          content: this.stringifyHitlResumePayload({
            type: 'hitl_external_result',
            requestId: resolution.requestId,
            kind: resolution.kind,
            prompt: request.prompt,
            result: resolution.externalResult,
            reason: resolution.reason
          })
        }
      ];
    }

    return [];
  }

  private async saveHitlResumeMessages(
    session: AgentSession,
    messages: AIMessage[]
  ): Promise<AgentSession> {
    const nextSession: AgentSession = {
      ...session,
      messages: [
        ...session.messages,
        ...messages.map(
          (message): AgentMessage => ({
            role: message.role,
            content: runtimeMessageToAgentContent(message.content),
            name: message.name,
            toolCallId: message.tool_call_id,
            createdAt: new Date().toISOString(),
            metadata: {
              source: 'hitl_resume'
            }
          })
        )
      ]
    };
    await this.sessionStore.saveSession(nextSession);
    return nextSession;
  }

  private stringifyHitlResumePayload(payload: Record<string, unknown>): string {
    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }

  private async publishRunPaused(
    spec: AgentRunSpec,
    permissionId: string,
    checkpointId?: string
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'run_paused'),
      type: 'run_paused',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'paused',
        reason: 'permission',
        permissionId,
        checkpointId
      }
    });
  }

  private async publishUserInputPaused(
    spec: AgentRunSpec,
    requestId: string,
    checkpointId?: string
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'run_paused'),
      type: 'run_paused',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'paused',
        reason: 'needs_input',
        requestId,
        checkpointId
      }
    });
  }

  private async publishRunResumed(
    session: Pick<AgentSession, 'runId' | 'sessionId'>,
    checkpointId?: string
  ): Promise<void> {
    if (await this.shouldSkipLifecycleEvent(session.runId)) return;
    await this.publishEvent({
      id: this.createEventId(session.runId, 'run_resumed'),
      type: 'run_resumed',
      runId: session.runId,
      sessionId: session.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'running',
        checkpointId
      }
    });
  }

  private async publishContextCompacted(
    spec: AgentRunSpec,
    record: ContextCompactionRecord
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'context_compacted'),
      type: 'context_compacted',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        strategy: record.strategy,
        beforeMessages: record.beforeMessages,
        afterMessages: record.afterMessages,
        summary: record.summary,
        artifactIds: record.artifactIds,
        beforeTokens: record.beforeTokens,
        afterTokens: record.afterTokens,
        fingerprint: record.fingerprint,
        builderVersion: record.builderVersion,
        summarySource: record.summarySource,
        summarizedMessages: record.summarizedMessages,
        retainedMessages: record.retainedMessages
      }
    });
  }

  private async publishContextUsagePreview(
    spec: AgentRunSpec,
    snapshot: ContextUsageSnapshot,
    round: number
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'context_usage_preview'),
      type: 'context_usage_preview',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        snapshot,
        round
      }
    });
  }

  private async publishArtifactSaved(
    spec: AgentRunSpec,
    artifact: AgentArtifactRef
  ): Promise<void> {
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'artifact_saved'),
      type: 'artifact_saved',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: artifact.createdAt || new Date().toISOString(),
      payload: {
        artifactId: artifact.artifactId,
        kind: artifact.kind,
        uri: artifact.uri,
        preview: artifact.preview,
        sizeBytes: artifact.sizeBytes,
        metadata: artifact.metadata
      }
    });
  }

  private async publishRunQueued(spec: AgentRunSpec): Promise<void> {
    await this.runRegistry?.register(spec);
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'run_queued'),
      type: 'run_queued',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        source: spec.source,
        status: 'queued',
        agentId: spec.agentDef?.id || spec.temporaryAgentDef?.id,
        workflowId: spec.workflowDef?.id
      }
    });
  }

  private async ensureRunQueued(spec: AgentRunSpec): Promise<void> {
    await this.runRegistry?.register(spec);
    const hasQueuedEvent = this.eventBus
      .getEvents(spec.runId)
      .some((event) => event.type === 'run_queued');
    if (!hasQueuedEvent) {
      await this.publishRunQueued(spec);
    }
  }

  private async publishRunStarted(
    spec: AgentRunSpec,
    workspace?: WorkspaceRef,
    policy?: WorkspacePolicy
  ): Promise<void> {
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
    const workspaceSummary = summarizeWorkspaceFromRef(workspace, policy);
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'run_started'),
      type: 'run_started',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        source: spec.source,
        status: 'running',
        agentId: spec.agentDef?.id || spec.temporaryAgentDef?.id,
        workflowId: spec.workflowDef?.id,
        ...(workspaceSummary ? { workspace: workspaceSummary } : {})
      }
    });
  }

  private async publishRunFinished(
    spec: AgentRunSpec,
    output: AgentRunOutput,
    durationMs: number
  ): Promise<void> {
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'run_finished'),
      type: 'run_finished',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'succeeded',
        output,
        durationMs
      }
    });
  }

  private async publishRunFailed(
    spec: AgentRunSpec,
    error: any,
    durationMs: number
  ): Promise<void> {
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return;
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'run_failed'),
      type: 'run_failed',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'failed',
        error: error?.message || String(error),
        durationMs
      }
    });
  }

  private async publishRunCancelRequested(
    target: { runId: string; sessionId: string },
    reason: 'manual' | 'client_disconnect' | 'timeout' | 'system'
  ): Promise<void> {
    const session = await this.sessionStore.getSessionByRunId(target.runId);
    if (session && (isClosedRunStatus(session.status) || session.status === 'cancelling')) return;
    const previousStatus =
      session && isCancellableRunStatus(session.status) ? session.status : undefined;
    await this.publishEvent({
      id: this.createEventId(target.runId, 'run_cancel_requested'),
      type: 'run_cancel_requested',
      runId: target.runId,
      sessionId: target.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'cancelling',
        previousStatus,
        reason
      }
    });
  }

  private async publishRunCancelled(
    target: { runId: string; sessionId: string; createdAt?: string },
    reason: 'manual' | 'client_disconnect' | 'timeout' | 'system',
    durationMs?: number
  ): Promise<void> {
    const session = await this.sessionStore.getSessionByRunId(target.runId);
    if (session && isClosedRunStatus(session.status) && session.status !== 'cancelling') return;
    if (!session || session.status !== 'cancelling') {
      await this.publishRunCancelRequested(target, reason);
    }
    const latestSession = await this.sessionStore.getSessionByRunId(target.runId);
    if (
      latestSession &&
      isClosedRunStatus(latestSession.status) &&
      latestSession.status !== 'cancelling'
    )
      return;
    const startedAt = new Date(
      latestSession?.createdAt ?? session?.createdAt ?? target.createdAt ?? ''
    ).getTime();
    const resolvedDurationMs =
      durationMs ?? (Number.isFinite(startedAt) ? Date.now() - startedAt : undefined);
    await this.publishEvent({
      id: this.createEventId(target.runId, 'run_cancelled'),
      type: 'run_cancelled',
      runId: target.runId,
      sessionId: target.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'cancelled',
        reason,
        durationMs: resolvedDurationMs
      }
    });
    await this.publishEvent({
      id: this.createEventId(target.runId, 'run_finished'),
      type: 'run_finished',
      runId: target.runId,
      sessionId: target.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'cancelled',
        durationMs: resolvedDurationMs,
        output: {
          content: '',
          stopReason: 'cancelled',
          metadata: { reason }
        }
      }
    });
  }

  private createRunControl(
    runId: string,
    parentSignal?: AbortSignal
  ): { controller: AbortController; dispose?: () => void } {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;

    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort(this.getAbortReason(parentSignal));
      } else {
        const abortFromParent = () => {
          if (!controller.signal.aborted) {
            controller.abort(this.getAbortReason(parentSignal));
          }
        };
        parentSignal.addEventListener('abort', abortFromParent, { once: true });
        dispose = () => parentSignal.removeEventListener('abort', abortFromParent);
      }
    }

    const control = { controller, dispose };
    this.runControlsByRunId.set(runId, control);
    return control;
  }

  private disposeRunControl(
    runId: string,
    control: { controller: AbortController; dispose?: () => void }
  ): void {
    control.dispose?.();
    if (this.runControlsByRunId.get(runId) === control) {
      this.runControlsByRunId.delete(runId);
    }
  }

  private getAbortReason(
    signal?: AbortSignal
  ): 'manual' | 'client_disconnect' | 'timeout' | 'system' {
    const reason = signal?.reason;
    if (typeof reason === 'string' && isCancelReason(reason)) return reason;
    if (reason && typeof reason === 'object') {
      const message = String((reason as { message?: unknown }).message || '').toLowerCase();
      if (message.includes('timeout')) return 'timeout';
      if (message.includes('disconnect') || message.includes('close')) return 'client_disconnect';
    }
    return 'manual';
  }

  private isCancellationError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true;
    if (!error || typeof error !== 'object') return false;
    const record = error as { name?: unknown; code?: unknown; message?: unknown };
    return (
      record.name === 'AbortError' ||
      record.code === 'ABORT_ERR' ||
      String(record.message || '')
        .toLowerCase()
        .includes('abort')
    );
  }

  private async publishEvent(event: AgentEvent): Promise<void> {
    const preparedEvent =
      typeof event.sequence === 'number' && Number.isFinite(event.sequence)
        ? normalizeAgentEvent(event)
        : normalizeAgentEvent(event, {
            sequence: await this.nextRunEventSequence(event.runId)
          });
    await this.publishPreparedEvent(preparedEvent);
  }

  private async publishPreparedEvent(preparedEvent: AgentEvent): Promise<void> {
    // Publish to the in-process bus FIRST so live SSE subscribers see the event
    // in the correct order relative to ephemeral deltas. If we awaited the DB
    // write before publishing, a subsequent chunk's ephemeral delta could land
    // in the bus during that await and be yielded before this persisted event,
    // scrambling the live UI order (the run only "settles" at the end).
    await this.eventBus.publish(preparedEvent);
    const persistedEvent = await this.sessionStore.appendEvent(preparedEvent);
    await this.runRegistry?.applyEvent(persistedEvent);
    // Cross-process wake-up: only the runId + seq travels; subscribers on other
    // instances pull the real event from agent_events. Best-effort.
    if (this.eventChannel && typeof persistedEvent.sequence === 'number') {
      void this.eventChannel.signal(persistedEvent.runId, persistedEvent.sequence);
    }
  }

  /**
   * Live SSE only: publish to the in-process event bus so `/events?stream=true`
   * subscribers receive token deltas immediately, without a DB row or NOTIFY.
   */
  private async publishLiveStreamEvent(event: AgentEvent): Promise<void> {
    await this.eventBus.publish(event);
  }

  private async nextRunEventSequence(runId: string): Promise<number> {
    const repos = this.sessionStore as {
      storeRepositories?: () =>
        | { agentEvents?: { nextSequence: (runId: string) => Promise<number> } }
        | undefined;
    };
    const tableRepos =
      typeof repos.storeRepositories === 'function' ? repos.storeRepositories() : undefined;
    if (tableRepos?.agentEvents) {
      return tableRepos.agentEvents.nextSequence(runId);
    }

    const eventsById = new Map<string, AgentEvent>();
    for (const event of this.eventBus.getEvents(runId)) {
      eventsById.set(event.id, event);
    }
    for (const event of (await this.sessionStore.getSessionByRunId(runId))?.events ?? []) {
      eventsById.set(event.id, event);
    }
    const events = [...eventsById.values()];
    const maxSequence = events.reduce((max, event) => {
      return typeof event.sequence === 'number' && Number.isFinite(event.sequence)
        ? Math.max(max, event.sequence)
        : max;
    }, 0);
    return Math.max(maxSequence, events.length) + 1;
  }

  private async shouldSkipLifecycleEvent(runId: string): Promise<boolean> {
    const session = await this.sessionStore.getSessionByRunId(runId);
    return Boolean(session && isExecutionLifecycleSuppressedStatus(session.status));
  }

  private async saveContextCompactionCheckpoint(
    spec: AgentRunSpec,
    runtimeOptions: ReActRuntimeOptions,
    record: ContextCompactionRecord
  ): Promise<string | undefined> {
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return undefined;
    if (!record.fingerprint) return undefined;

    const session = await this.sessionStore.getSessionByRunId(spec.runId);
    const existing = session?.checkpoints.find((checkpoint) => {
      const context = checkpoint.metadata?.context;
      return (
        Boolean(context) &&
        typeof context === 'object' &&
        !Array.isArray(context) &&
        (context as Record<string, unknown>).fingerprint === record.fingerprint
      );
    });
    if (existing) return existing.checkpointId;

    const checkpointId = `checkpoint_${spec.runId}_context_${record.fingerprint}`;
    await this.sessionStore.saveCheckpoint(spec.sessionId, {
      checkpointId,
      runId: spec.runId,
      sessionId: spec.sessionId,
      reason: 'context_compaction',
      status: 'running',
      messages: this.toAgentMessages(runtimeOptions.messages),
      events: this.eventBus.getEvents(spec.runId),
      workspace: runtimeOptions.workspace?.workspace,
      createdAt: new Date().toISOString(),
      metadata: {
        context: {
          builderVersion: record.builderVersion ?? AGENT_CONTEXT_BUILDER_VERSION,
          fingerprint: record.fingerprint,
          compacted: record.compacted,
          summary: record.summary,
          summarySource: record.summarySource,
          artifactIds: record.artifactIds,
          beforeMessages: record.beforeMessages,
          afterMessages: record.afterMessages,
          beforeTokens: record.beforeTokens,
          afterTokens: record.afterTokens,
          summarizedMessages: record.summarizedMessages,
          retainedMessages: record.retainedMessages
        }
      }
    });

    if (await this.shouldSkipLifecycleEvent(spec.runId)) return undefined;
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'checkpoint_saved'),
      type: 'checkpoint_saved',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        checkpointId,
        reason: 'context_compaction'
      }
    });
    return checkpointId;
  }

  private async savePermissionCheckpoint(
    spec: AgentRunSpec,
    request: PermissionRequest,
    runtimeOptions: ReActRuntimeOptions,
    state?: ReActRuntimePermissionPauseState
  ): Promise<string | undefined> {
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return undefined;
    const checkpointId = this.createCheckpointId(spec.runId, request.permissionId);
    const hitlRequest = {
      ...this.hitlRequestFromPermission(request),
      checkpointId
    };
    await this.sessionStore.saveCheckpoint(spec.sessionId, {
      checkpointId,
      runId: spec.runId,
      sessionId: spec.sessionId,
      reason: 'permission',
      status: 'paused',
      messages: this.toAgentMessages(runtimeOptions.messages),
      events: this.eventBus.getEvents(spec.runId),
      pendingPermission: request,
      pendingHitl: hitlRequest,
      workspace: runtimeOptions.workspace?.workspace,
      state: state ? this.toCheckpointPermissionState(state) : undefined,
      createdAt: new Date().toISOString(),
      metadata: {
        permissionId: request.permissionId,
        toolName: request.subject.toolName,
        workspaceId: runtimeOptions.workspace?.workspace?.workspaceId
      }
    });
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return undefined;
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'checkpoint_saved'),
      type: 'checkpoint_saved',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        checkpointId,
        reason: 'permission',
        permissionId: request.permissionId,
        requestId: hitlRequest.requestId
      }
    });
    return checkpointId;
  }

  private async saveUserInputCheckpoint(
    spec: AgentRunSpec,
    request: UserInputPauseRequest,
    runtimeOptions: ReActRuntimeOptions,
    state?: ReActRuntimePermissionPauseState
  ): Promise<string | undefined> {
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return undefined;
    const checkpointId = this.createCheckpointId(spec.runId, request.requestId);
    const hitlRequest = {
      ...this.hitlRequestFromUserInput(request),
      checkpointId
    };
    await this.sessionStore.saveCheckpoint(spec.sessionId, {
      checkpointId,
      runId: spec.runId,
      sessionId: spec.sessionId,
      reason: 'needs_input',
      status: 'paused',
      messages: this.toAgentMessages(runtimeOptions.messages),
      events: this.eventBus.getEvents(spec.runId),
      pendingHitl: hitlRequest,
      workspace: runtimeOptions.workspace?.workspace,
      state: state ? this.toCheckpointPermissionState(state) : undefined,
      createdAt: new Date().toISOString(),
      metadata: {
        requestId: request.requestId,
        toolName: request.toolName,
        toolCallId: request.toolCallId,
        workspaceId: runtimeOptions.workspace?.workspace?.workspaceId
      }
    });
    if (await this.shouldSkipLifecycleEvent(spec.runId)) return undefined;
    await this.publishEvent({
      id: this.createEventId(spec.runId, 'checkpoint_saved'),
      type: 'checkpoint_saved',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        checkpointId,
        reason: 'needs_input',
        requestId: hitlRequest.requestId
      }
    });
    return checkpointId;
  }

  private toAgentMessages(messages: ReActRuntimeOptions['messages']): AgentMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content: runtimeMessageToAgentContent(message.content),
      name: message.name,
      toolCallId: message.tool_call_id,
      metadata: {
        toolCalls: message.tool_calls,
        rawParts: message.raw_parts
      }
    }));
  }

  private toCheckpointPermissionState(
    state: ReActRuntimePermissionPauseState
  ): Record<string, unknown> {
    return {
      pendingToolCall: state.pendingToolCall,
      roundIndex: state.roundIndex,
      assistantContent: state.assistantContent,
      acceptedToolCallCount: state.acceptedToolCallCount,
      acceptedToolCallsThisRound: state.acceptedToolCallsThisRound
    };
  }

  private resolveCheckpoint(session: AgentSession, checkpointId?: string) {
    if (!checkpointId) return session.checkpoints.at(-1);
    return session.checkpoints.find((checkpoint) => checkpoint.checkpointId === checkpointId);
  }

  private readPermissionPauseState(
    state: Record<string, unknown> | undefined
  ): ReActRuntimePermissionPauseState | undefined {
    if (!state) return undefined;
    const pendingToolCall = state.pendingToolCall;
    if (!pendingToolCall || typeof pendingToolCall !== 'object') return undefined;
    const record = pendingToolCall as Record<string, unknown>;
    if (typeof record.name !== 'string' || !record.name.trim()) return undefined;
    const args = record.arguments;
    return {
      pendingToolCall: {
        id: typeof record.id === 'string' ? record.id : undefined,
        name: record.name,
        arguments:
          args && typeof args === 'object' && !Array.isArray(args)
            ? { ...(args as Record<string, unknown>) }
            : {},
        rawArguments: record.rawArguments,
        parseError: typeof record.parseError === 'string' ? record.parseError : undefined,
        source: typeof record.source === 'string' ? record.source : undefined
      },
      roundIndex: typeof state.roundIndex === 'number' ? state.roundIndex : 1,
      assistantContent:
        typeof state.assistantContent === 'string' ? state.assistantContent : undefined,
      acceptedToolCallCount:
        typeof state.acceptedToolCallCount === 'number' ? state.acceptedToolCallCount : undefined,
      acceptedToolCallsThisRound:
        typeof state.acceptedToolCallsThisRound === 'number'
          ? state.acceptedToolCallsThisRound
          : undefined
    };
  }

  private specFromSession(session: AgentSession): AgentRunSpec {
    return {
      runId: session.runId,
      sessionId: session.sessionId,
      threadId: session.threadId,
      source: session.source,
      input: {
        messages: session.messages
      },
      workspacePolicy: session.workspace
        ? {
            ...(isWorkspacePolicyRecord(session.metadata?.workspacePolicy)
              ? session.metadata.workspacePolicy
              : {}),
            mode: session.workspace.mode,
            cleanup: 'manual'
          }
        : { mode: 'none' },
      metadata: session.metadata
    };
  }

  private async cleanupWorkspaceIfNeeded(
    spec: AgentRunSpec,
    policy: WorkspacePolicy,
    workspace: WorkspaceRef | undefined,
    outcome: 'success' | 'failed'
  ): Promise<void> {
    if (!workspace || !this.workspaceManager.shouldCleanup(policy, outcome)) return;
    await this.workspaceManager.cleanupWorkspace(workspace);
    await this.sessionStore.updateWorkspace(
      spec.sessionId,
      {
        ...workspace,
        metadata: {
          ...workspace.metadata,
          cleanedAt: new Date().toISOString(),
          cleanupOutcome: outcome
        }
      },
      spec.runId
    );
  }

  private async *createEventStream(runId: string): AsyncIterable<AgentEvent> {
    const backlog = await this.getEvents(runId);
    for (const event of backlog) {
      yield event;
    }
  }

  private createCheckpointId(runId: string, permissionId: string): string {
    return `checkpoint_${runId}_${permissionId}_${Date.now().toString(36)}`;
  }

  private createEventId(runId: string, type: string): string {
    return `${runId}:${type}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  }

  getRunRegistry(): AgentRunRegistry | undefined {
    return this.runRegistry;
  }
}

function isWorkspacePolicyRecord(value: unknown): value is WorkspacePolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const mode = (value as { mode?: unknown }).mode;
  return mode === 'none' || mode === 'local' || mode === 'docker' || mode === 'remote';
}

function isCancelReason(
  value: string
): value is 'manual' | 'client_disconnect' | 'timeout' | 'system' {
  return (
    value === 'manual' || value === 'client_disconnect' || value === 'timeout' || value === 'system'
  );
}

/**
 * High-frequency streaming deltas that must never hit `agent_events` (no DB INSERT,
 * no cross-process NOTIFY). They are published on the in-memory event bus only so
 * live SSE clients (`/api/agent-runs/:runId/events`) still receive token-by-token
 * updates. Negative sequences avoid colliding with persisted DB-backed seq numbers.
 *
 * Replay after refresh uses round-terminal events (`model_finished`,
 * `message_finished`, `tool_call_requested`).
 */
function isEphemeralStreamEvent(event: AgentEvent): boolean {
  if (
    event.type === 'reasoning_delta' ||
    event.type === 'model_delta' ||
    event.type === 'message_delta'
  ) {
    return true;
  }
  if (event.type !== 'custom') return false;
  const name = (event.payload as { name?: unknown } | undefined)?.name;
  return name === 'tool_calls_delta';
}
