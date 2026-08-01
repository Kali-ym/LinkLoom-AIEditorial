import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { BaseTool } from '../src/plugins/base/BaseTool.js';
import { AgentService } from '../src/services/agents/AgentService.js';
import { ReActAgentEngine } from '../src/services/agents/engine/ReActAgentEngine.js';
import { InMemoryAgentRunRegistry } from '../src/services/agents/engine/AgentRunRegistry.js';
import { InMemoryAgentSessionStore } from '../src/services/agents/engine/AgentSessionStore.js';
import { InMemoryAgentEventBus } from '../src/services/agents/engine/EventBus.js';
import { evaluateRunStatusTransition } from '../src/services/agents/engine/AgentRunStateMachine.js';
import { AgentRuntimeManager } from '../src/services/agents/managers/AgentRuntimeManager.js';
import { AgentRunQueueManager } from '../src/services/agents/managers/AgentRunQueueManager.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';
import type { AgentRunSpec } from '../src/services/agents/engine/AgentRunSpec.js';
import type { AIMessage } from '../src/types/index.js';
import type { AgentDefinition } from '../src/types/agent.js';
import { PI_CONTEXT_PROTOCOL_VERSION, createTurnContext } from '../src/services/agents/context/PiContextTypes.js';

class ResumePermissionTool extends BaseTool {
  readonly id = 'resume_write_tool';
  readonly name = 'resume_write_tool';
  readonly description = 'Writes a value for permission resume tests';
  readonly parameters = {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  };

  async handler(args: { text?: string }) {
    return { resumed: args.text || '' };
  }
}

class AbortWaitTool extends BaseTool {
  readonly id = 'abort_wait_tool';
  readonly name = 'abort_wait_tool';
  readonly description = 'Waits until its execution signal is aborted';
  readonly parameters = {
    type: 'object',
    properties: {}
  };

  async handler(_args: unknown, ctx?: ToolExecutionContext) {
    if (!ctx?.signal) throw new Error('missing abort signal');
    if (ctx.signal.aborted) throw new Error('aborted before tool start');
    await new Promise<void>((resolve) => {
      ctx.signal?.addEventListener('abort', () => resolve(), { once: true });
    });
    throw new Error('tool observed abort');
  }
}

function createSpec(id = 'control'): AgentRunSpec {
  return {
    runId: `run_${id}`,
    sessionId: `session_${id}`,
    source: 'api',
    input: {
      prompt: 'hello',
      messages: [{ role: 'user', content: 'hello' }]
    },
    workspacePolicy: { mode: 'local' }
  };
}

describe('ReActAgentEngine run control plane', () => {
  it('keeps queued cancellation terminal and skips late execution side effects', async () => {
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = createSpec('queued_cancel');

    await engine.prepareRun(spec);
    await expect(engine.cancelRun(spec.runId, 'manual')).resolves.toEqual({ status: 'cancelled' });

    const output = await engine.run(spec, {
      runtimeOptions: {
        agentDef: {
          id: 'agent-control',
          name: 'Agent Control',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: []
        } as any,
        provider: { name: 'test', generateContent: async () => ({ content: 'late' }) } as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: [{ role: 'user', content: 'hello' }]
      }
    });

    const session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);
    const events = await engine.getEvents(spec.runId);

    expect(output).toMatchObject({ content: '', stopReason: 'cancelled' });
    expect(session?.status).toBe('cancelled');
    expect(run?.status).toBe('cancelled');
    expect(session?.workspace).toBeUndefined();
    expect(events.map((event) => event.type)).toEqual([
      'run_queued',
      'run_cancel_requested',
      'run_cancelled',
      'run_finished'
    ]);
  });

  it('keeps shared session writes scoped to the active run record', async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    const first = {
      ...createSpec('shared_first'),
      sessionId: 'session_shared',
      threadId: 'thread_shared'
    } satisfies AgentRunSpec;
    const second = {
      ...createSpec('shared_second'),
      sessionId: 'session_shared',
      threadId: 'thread_shared'
    } satisfies AgentRunSpec;

    await sessionStore.createSession(first);
    await sessionStore.updateStatus(first.sessionId, 'running');
    await sessionStore.updateOutput(first.sessionId, { content: 'first output' });
    await sessionStore.updateStatus(first.sessionId, 'succeeded');
    await sessionStore.createSession(second);
    await sessionStore.updateStatus(second.sessionId, 'running');
    await sessionStore.updateOutput(second.sessionId, { content: 'second output' });

    const firstSession = await sessionStore.getSessionByRunId(first.runId);
    const secondSession = await sessionStore.getSessionByRunId(second.runId);
    const grouped = await sessionStore.getSessionsBySessionId('session_shared');
    const aggregate = await sessionStore.getSession('session_shared');

    expect(firstSession).toMatchObject({
      runId: first.runId,
      sessionId: 'session_shared',
      status: 'succeeded',
      output: { content: 'first output' }
    });
    expect(secondSession).toMatchObject({
      runId: second.runId,
      sessionId: 'session_shared',
      status: 'running',
      output: { content: 'second output' }
    });
    expect(grouped.map((session) => session.runId)).toEqual([first.runId, second.runId]);
    expect(aggregate).toMatchObject({
      sessionId: 'session_shared',
      runId: second.runId,
      status: 'running',
      metadata: expect.objectContaining({ aggregate: true, runIds: [first.runId, second.runId] })
    });
  });

  it('archives only terminal runs and preserves previous status metadata', async () => {
    const engine = new ReActAgentEngine(
      new InMemoryAgentEventBus(),
      new InMemoryAgentSessionStore(),
      new InMemoryAgentRunRegistry()
    );
    const spec = createSpec('archive');

    await engine.prepareRun(spec);
    await expect(engine.archiveRun(spec.runId)).rejects.toThrow(
      'Only terminal runs can be archived'
    );
    await engine.cancelRun(spec.runId, 'manual');
    await expect(engine.archiveRun(spec.runId, 'cleanup')).resolves.toEqual({ status: 'archived' });

    const session = await engine.getSessionByRunId(spec.runId);
    const events = await engine.getEvents(spec.runId);

    expect(session?.status).toBe('archived');
    expect(session?.metadata).toMatchObject({
      archivedReason: 'cleanup',
      archivedPreviousStatus: 'cancelled'
    });
    expect(events.at(-1)).toMatchObject({
      type: 'run_archived',
      payload: expect.objectContaining({ previousStatus: 'cancelled' })
    });
  });

  it('persists context compaction refs and model output artifacts on the active run', async () => {
    const artifactRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'linkloom-agent-control-artifact-')
    );
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = {
      ...createSpec('context_artifact'),
      workspacePolicy: { mode: 'local' as const, rootDir: artifactRoot },
      contextPolicy: {
        compactionStrategy: 'summarize' as const,
        maxMessages: 3,
        summarizeOlderThanMessages: 3,
        maxInputTokens: 16,
        artifactPolicy: {
          enabled: true,
          maxInlineBytes: 16,
          previewBytes: 24
        }
      }
    } satisfies AgentRunSpec;
    const modelOutput = 'model-output-'.repeat(8);
    const seenPrompts: AIMessage[][] = [];

    await engine.prepareRun(spec);
    const result = await engine.run(spec, {
      runtimeOptions: {
        agentDef: {
          id: 'context-artifact-agent',
          name: 'Context Artifact Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: [],
          runtime: { mode: 'classic', maxRounds: 1, returnTrace: true }
        } as any,
        provider: {
          name: 'test-provider',
          async generateContent(prompt: AIMessage[]) {
            seenPrompts.push(prompt);
            return { content: modelOutput };
          }
        } as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: [
          { role: 'user', content: 'first fact artifact_run_context_artifact_ref' },
          { role: 'assistant', content: 'first answer' },
          { role: 'user', content: 'second fact' },
          { role: 'assistant', content: 'second answer' },
          { role: 'user', content: 'latest question' }
        ],
        silent: true
      }
    });

    const session = await engine.getSessionByRunId(spec.runId);
    const events = await engine.getEvents(spec.runId);
    const contextEvent = events.find((event) => event.type === 'context_compacted');
    const artifactEvent = events.find((event) => event.type === 'artifact_saved');
    const contextCheckpoints =
      session?.checkpoints.filter((checkpoint) => checkpoint.reason === 'context_compaction') ?? [];
    const artifactPath = session?.artifacts[0]?.metadata?.workspacePath;

    expect(result).toMatchObject({ content: modelOutput, stopReason: 'final' });
    expect(
      seenPrompts
        .at(-1)
        ?.some(
          (message) =>
            message.role === 'system' &&
            String(message.content).includes('artifact_run_context_artifact_ref')
        )
    ).toBe(true);
    expect(contextEvent).toMatchObject({
      payload: expect.objectContaining({
        artifactIds: ['artifact_run_context_artifact_ref']
      })
    });
    expect(contextCheckpoints).toHaveLength(1);
    expect(contextCheckpoints[0]).toMatchObject({
      status: 'running',
      metadata: {
        context: {
          compacted: true,
          fingerprint: expect.any(String)
        }
      }
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'checkpoint_saved',
        payload: expect.objectContaining({
          reason: 'context_compaction',
          checkpointId: contextCheckpoints[0]?.checkpointId
        })
      })
    );
    expect(artifactEvent).toMatchObject({
      payload: expect.objectContaining({
        kind: 'model_output',
        preview: expect.stringContaining('model-output-')
      })
    });
    expect(session?.artifacts).toHaveLength(1);
    expect(session?.artifacts[0]).toMatchObject({
      kind: 'model_output',
      metadata: expect.objectContaining({ runId: spec.runId, storage: 'workspace' })
    });
    expect(typeof artifactPath).toBe('string');
    await expect(fs.readFile(String(artifactPath), 'utf8')).resolves.toBe(modelOutput);
    await fs.rm(artifactRoot, { recursive: true, force: true });
  });

  it('cancels a non-stream run by aborting the running local tool signal', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new AbortWaitTool());
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const controller = new AbortController();
    const spec = {
      ...createSpec('non_stream_abort_tool'),
      agentDef: {
        id: 'abort-agent',
        name: 'Abort Agent',
        description: '',
        systemPrompt: '',
        providerId: 'test',
        model: 'test',
        temperature: 0,
        toolIds: ['abort_wait_tool'],
        skillIds: [],
        mcpServerIds: [],
        runtime: { mode: 'react', maxRounds: 2, returnTrace: true }
      } as any,
      tools: [new AbortWaitTool()]
    } satisfies AgentRunSpec;
    const runtimeOptions = {
      agentDef: spec.agentDef,
      provider: {
        name: 'test-provider',
        async generateContent() {
          return {
            content: '',
            tool_calls: [{ id: 'abort-call-1', name: 'abort_wait_tool', arguments: {} }]
          };
        }
      } as any,
      tools: spec.tools ?? [],
      mcpConfigs: [],
      mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
      toolRegistry,
      messages: [{ role: 'user', content: 'abort tool' }],
      silent: true
    };

    await engine.prepareRun(spec);
    const runPromise = engine.run(spec, {
      runtimeOptions,
      signal: controller.signal
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    controller.abort('client_disconnect');

    await expect(runPromise).resolves.toMatchObject({ content: '', stopReason: 'cancelled' });
    const session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);
    const eventTypes = (await engine.getEvents(spec.runId)).map((event) => event.type);

    expect(session?.status).toBe('cancelled');
    expect(run?.status).toBe('cancelled');
    expect(eventTypes).toContain('run_cancel_requested');
    expect(eventTypes).toContain('run_cancelled');
    expect(eventTypes).not.toContain('run_failed');
  });

  it('marks a queued runtime run cancelled when its AbortSignal fires before queue acquisition', async () => {
    const engine = new ReActAgentEngine(
      new InMemoryAgentEventBus(),
      new InMemoryAgentSessionStore(),
      new InMemoryAgentRunRegistry()
    );
    const queue = new AgentRunQueueManager({ maxConcurrentRuns: 1 });
    const runtimeManager = new AgentRuntimeManager(engine, queue);
    const activeLease = await queue.acquire(createSpec('queued_abort_active'));
    const spec = createSpec('queued_abort_waiting');
    const controller = new AbortController();

    await engine.prepareRun(spec);
    const runPromise = runtimeManager.run({
      runSpec: spec,
      provider: {
        name: 'test-provider',
        generateContent: async () => ({ content: 'late' })
      } as any,
      runtimeOptions: {
        agentDef: {
          id: 'queued-abort-agent',
          name: 'Queued Abort Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: []
        } as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: []
      },
      signal: controller.signal
    });
    await Promise.resolve();
    controller.abort('client_disconnect');

    await expect(runPromise).rejects.toThrow('Agent run queue wait aborted');
    const session = await engine.getSessionByRunId(spec.runId);
    const eventTypes = (await engine.getEvents(spec.runId)).map((event) => event.type);

    expect(session?.status).toBe('cancelled');
    expect(eventTypes).toEqual([
      'run_queued',
      'run_cancel_requested',
      'run_cancelled',
      'run_finished'
    ]);
    expect(queue.snapshot).toMatchObject({ activeRuns: 1, queuedRuns: 0 });
    activeLease.release();
  });

  it('cancels permission resume while the approved pending tool is running', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new AbortWaitTool());
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const controller = new AbortController();
    const spec = createSpec('permission_resume_abort');
    const permissionId = 'permission-abort-1';
    const checkpointId = 'checkpoint-permission-abort-1';

    await engine.prepareRun(spec);
    await engine.recordExternalEvent({
      id: 'run-started-permission-abort',
      type: 'run_started',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        source: spec.source,
        status: 'running',
        agentId: spec.agentDef?.id
      }
    });
    await engine.recordExternalEvent({
      id: 'permission-required-abort',
      type: 'permission_required',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        permissionId,
        runId: spec.runId,
        sessionId: spec.sessionId,
        subject: { toolName: 'abort_wait_tool' },
        arguments: {},
        requestedAt: new Date().toISOString()
      }
    });
    await sessionStore.saveCheckpoint(spec.sessionId, {
      checkpointId,
      runId: spec.runId,
      sessionId: spec.sessionId,
      reason: 'permission',
      status: 'paused',
      messages: [{ role: 'user', content: 'resume abort' }],
      pendingPermission: {
        permissionId,
        runId: spec.runId,
        sessionId: spec.sessionId,
        subject: { toolName: 'abort_wait_tool' },
        arguments: {},
        requestedAt: new Date().toISOString()
      },
      state: {
        pendingToolCall: { id: 'abort-pending-call', name: 'abort_wait_tool', arguments: {} },
        roundIndex: 1,
        assistantContent: ''
      },
      createdAt: new Date().toISOString()
    });

    const resumePromise = engine.resume(spec.sessionId, {
      decision: {
        permissionId,
        effect: 'allow',
        resolvedBy: 'human',
        resolvedAt: new Date().toISOString()
      },
      runtimeOptions: {
        agentDef: {
          id: 'permission-resume-abort-agent',
          name: 'Permission Resume Abort Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: ['abort_wait_tool'],
          skillIds: [],
          mcpServerIds: [],
          runtime: { mode: 'react', maxRounds: 2, returnTrace: true }
        } as any,
        provider: {
          name: 'test-provider',
          generateContent: async () => ({ content: 'late' })
        } as any,
        tools: [new AbortWaitTool()],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry,
        messages: [{ role: 'user', content: 'resume abort' }],
        silent: true
      },
      signal: controller.signal
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    controller.abort('client_disconnect');

    await expect(resumePromise).resolves.toMatchObject({ content: '', stopReason: 'cancelled' });
    const session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);
    const eventTypes = (await engine.getEvents(spec.runId)).map((event) => event.type);

    expect(session?.status).toBe('cancelled');
    expect(run?.status).toBe('cancelled');
    expect(eventTypes).toContain('run_resumed');
    expect(eventTypes).toContain('run_cancelled');
    expect(eventTypes).not.toContain('run_failed');
  });

  it('cancels HITL resume while the continuation provider is running', async () => {
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const controller = new AbortController();
    const spec = createSpec('hitl_resume_abort');
    let providerSignal: AbortSignal | undefined;

    await engine.prepareRun(spec);
    await engine.recordExternalEvent({
      id: 'hitl-required-abort',
      type: 'hitl_required',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        requestId: 'hitl-abort-1',
        kind: 'needs_input',
        status: 'pending',
        prompt: 'Need input',
        allowedActions: ['provide_input']
      }
    });
    await engine.recordExternalEvent({
      id: 'run-paused-hitl-abort',
      type: 'run_paused',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'paused',
        reason: 'needs_input'
      }
    });

    const resumePromise = engine.resumeHitl(spec.sessionId, {
      resolution: {
        requestId: 'hitl-abort-1',
        kind: 'needs_input',
        status: 'resolved',
        action: 'provide_input',
        input: 'continue',
        resolvedAt: new Date().toISOString()
      },
      runtimeOptions: {
        agentDef: {
          id: 'hitl-resume-abort-agent',
          name: 'HITL Resume Abort Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: [],
          runtime: { mode: 'react', maxRounds: 1, returnTrace: true }
        } as any,
        provider: {
          name: 'test-provider',
          async generateContent(
            _messages: AIMessage[],
            _tools: unknown[],
            _systemInstruction?: string,
            options?: { signal?: AbortSignal }
          ) {
            providerSignal = options?.signal;
            await new Promise<void>((resolve) => {
              options?.signal?.addEventListener('abort', () => resolve(), { once: true });
            });
            throw new Error('provider observed abort');
          }
        } as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: [{ role: 'user', content: 'original' }],
        silent: true
      },
      signal: controller.signal
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    controller.abort('client_disconnect');

    await expect(resumePromise).resolves.toMatchObject({ content: '', stopReason: 'cancelled' });
    const session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);
    const eventTypes = (await engine.getEvents(spec.runId)).map((event) => event.type);

    expect(providerSignal?.aborted).toBe(true);
    expect(session?.status).toBe('cancelled');
    expect(run?.status).toBe('cancelled');
    expect(eventTypes).toContain('hitl_resolved');
    expect(eventTypes).toContain('run_resumed');
    expect(eventTypes).toContain('run_cancelled');
    expect(eventTypes).not.toContain('run_failed');
  });

  it('resumes a paused permission run by executing the pending tool and continuing rounds', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new ResumePermissionTool());
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = {
      ...createSpec('permission_resume'),
      agentDef: {
        id: 'resume-agent',
        name: 'Resume Agent',
        description: '',
        systemPrompt: '',
        providerId: 'test',
        model: 'test',
        temperature: 0,
        toolIds: ['resume_write_tool'],
        skillIds: [],
        mcpServerIds: [],
        runtime: { mode: 'react', maxRounds: 3, returnTrace: true }
      } as any,
      tools: [new ResumePermissionTool()]
    } satisfies AgentRunSpec;
    const messages: AIMessage[] = [
      { role: 'system', content: 'test' },
      { role: 'user', content: 'run gated tool' }
    ];
    const provider = {
      name: 'test-provider',
      calls: 0,
      async generateContent() {
        this.calls += 1;
        if (this.calls === 1) {
          return {
            content: '',
            tool_calls: [
              { id: 'call-resume-1', name: 'resume_write_tool', arguments: { text: 'approved' } }
            ]
          };
        }
        return { content: 'resumed final' };
      }
    };
    const runtimeOptions = {
      agentDef: spec.agentDef,
      provider,
      tools: spec.tools ?? [],
      mcpConfigs: [],
      mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
      toolRegistry,
      messages,
      silent: true,
      budgetPolicy: spec.budgetPolicy,
      observationPolicy: spec.observationPolicy
    };

    await engine.prepareRun(spec);
    const paused = await engine.run(spec, { runtimeOptions });
    let session = await engine.getSessionByRunId(spec.runId);

    expect(paused.stopReason).toBe('permission_required');
    expect(session?.status).toBe('paused');
    expect(session?.pendingPermission?.subject.toolName).toBe('resume_write_tool');
    expect(session?.pendingHitl).toMatchObject({
      requestId: session?.pendingPermission?.permissionId,
      kind: 'confirmation',
      status: 'pending',
      permissionId: session?.pendingPermission?.permissionId,
      proposedArguments: { text: 'approved' },
      allowedActions: expect.arrayContaining(['allow', 'deny', 'edit_arguments', 'cancel'])
    });
    expect(session?.checkpoints).toHaveLength(1);
    expect(session?.pendingHitl?.checkpointId).toBe(session?.checkpoints[0].checkpointId);
    const pausedRun = await registry.get(spec.runId);
    expect(pausedRun?.status).toBe('paused');
    expect(pausedRun?.pendingHitl?.checkpointId).toBe(session?.checkpoints[0].checkpointId);
    const checkpointSaved = (await engine.getEvents(spec.runId)).find(
      (event) => event.type === 'checkpoint_saved'
    );
    expect(checkpointSaved?.payload).toMatchObject({
      checkpointId: session?.checkpoints[0].checkpointId,
      permissionId: session?.pendingPermission?.permissionId,
      requestId: session?.pendingHitl?.requestId
    });
    expect(session?.checkpoints[0].state).toMatchObject({
      pendingToolCall: {
        id: 'call-resume-1',
        name: 'resume_write_tool',
        arguments: { text: 'approved' }
      }
    });

    const decision = {
      permissionId: session!.pendingPermission!.permissionId,
      effect: 'allow' as const,
      reason: 'approved by test',
      resolvedBy: 'human' as const,
      resolvedAt: new Date().toISOString()
    };
    const resumed = await engine.resume(spec.sessionId, {
      decision,
      runtimeOptions: {
        ...runtimeOptions,
        messages: messages.map((message) => ({ ...message }))
      }
    });
    session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);
    const eventTypes = (await engine.getEvents(spec.runId)).map((event) => event.type);

    expect(resumed).toMatchObject({ content: 'resumed final', stopReason: 'final' });
    expect(session?.status).toBe('succeeded');
    expect(run?.status).toBe('succeeded');
    expect(session?.pendingPermission).toBeUndefined();
    expect(session?.pendingHitl).toBeUndefined();
    expect(eventTypes).toContain('permission_resolved');
    expect(eventTypes).toContain('hitl_required');
    expect(eventTypes).toContain('hitl_resolved');
    expect(eventTypes).toContain('run_resumed');
    expect(eventTypes).toContain('tool_finished');
    expect(eventTypes.at(-1)).toBe('run_finished');
    expect(provider.calls).toBe(2);
  });

  it('resolves permission-backed HITL argument edits by resuming the paused tool with edited args', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new ResumePermissionTool());
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = {
      ...createSpec('permission_hitl_edit'),
      agentDef: {
        id: 'resume-hitl-edit-agent',
        name: 'Resume HITL Edit Agent',
        description: '',
        systemPrompt: '',
        providerId: 'test',
        model: 'test',
        temperature: 0,
        toolIds: ['resume_write_tool'],
        skillIds: [],
        mcpServerIds: [],
        runtime: { mode: 'react', maxRounds: 3, returnTrace: true }
      } as any,
      tools: [new ResumePermissionTool()]
    } satisfies AgentRunSpec;
    const messages: AIMessage[] = [
      { role: 'system', content: 'test' },
      { role: 'user', content: 'run gated tool' }
    ];
    const provider = {
      name: 'test-provider',
      calls: 0,
      async generateContent() {
        this.calls += 1;
        if (this.calls === 1) {
          return {
            content: '',
            tool_calls: [
              { id: 'call-hitl-edit-1', name: 'resume_write_tool', arguments: { text: 'original' } }
            ]
          };
        }
        return { content: 'edited final' };
      }
    };
    const runtimeOptions = {
      agentDef: spec.agentDef,
      provider,
      tools: spec.tools ?? [],
      mcpConfigs: [],
      mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
      toolRegistry,
      messages,
      silent: true
    };

    await engine.prepareRun(spec);
    const paused = await engine.run(spec, { runtimeOptions });
    let session = await engine.getSessionByRunId(spec.runId);

    expect(paused.stopReason).toBe('permission_required');
    expect(session?.pendingHitl).toMatchObject({
      requestId: session?.pendingPermission?.permissionId,
      kind: 'confirmation',
      proposedArguments: { text: 'original' }
    });
    const hitlRequestId = session!.pendingHitl!.requestId;

    const service = new AgentService(
      {} as any,
      { name: 'test-provider', generateContent: async () => ({ content: 'unused' }) } as any,
      { listSkillMetadata: () => [] } as any,
      { getTools: async () => [], callTool: async () => ({}) } as any
    );
    (service as any).agentEngine = engine;
    (service as any).runtimeManager = new AgentRuntimeManager(engine);
    vi.spyOn(service as any, 'buildResumeRuntimeContext').mockResolvedValue({
      runSpec: spec,
      provider,
      runtimeOptions: {
        ...runtimeOptions,
        messages: messages.map((message) => ({ ...message }))
      }
    });

    const resumed = await service.resolveRunHitl({
      runId: spec.runId,
      requestId: hitlRequestId,
      action: 'edit_arguments',
      editedArguments: { text: 'edited' },
      reason: 'fix argument before approval'
    });
    session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);
    const events = await engine.getEvents(spec.runId);
    const hitlResolved = events.find(
      (event) => event.type === 'hitl_resolved' && event.payload.action === 'edit_arguments'
    );

    expect(resumed).toMatchObject({ content: 'edited final', stopReason: 'final' });
    expect(session?.status).toBe('succeeded');
    expect(run?.status).toBe('succeeded');
    expect(session?.pendingPermission).toBeUndefined();
    expect(session?.pendingHitl).toBeUndefined();
    expect(hitlResolved).toMatchObject({
      payload: expect.objectContaining({
        requestId: session?.metadata?.lastPermissionDecision?.permissionId,
        kind: 'confirmation',
        action: 'edit_arguments',
        editedArguments: { text: 'edited' },
        metadata: expect.objectContaining({ hitlAction: 'edit_arguments' })
      })
    });
    expect(session?.output?.trace?.rounds[0].toolCalls[0]).toMatchObject({
      id: 'call-hitl-edit-1',
      name: 'resume_write_tool',
      arguments: { text: 'edited' }
    });
    expect(session?.output?.trace?.rounds[0].observations[0]).toMatchObject({
      data: { resumed: 'edited' }
    });
    expect(provider.calls).toBe(2);
  });

  it('applies resume middleware metadata before finishing permission resume', async () => {
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(new ResumePermissionTool());
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = {
      ...createSpec('permission_resume_middleware'),
      agentDef: {
        id: 'resume-agent-middleware',
        name: 'Resume Agent Middleware',
        description: '',
        systemPrompt: '',
        providerId: 'test',
        model: 'test',
        temperature: 0,
        toolIds: ['resume_write_tool'],
        skillIds: [],
        mcpServerIds: [],
        runtime: { mode: 'react', maxRounds: 3, returnTrace: true }
      } as any,
      tools: [new ResumePermissionTool()]
    } satisfies AgentRunSpec;
    const messages: AIMessage[] = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'run gated tool' }
    ];
    const provider = {
      name: 'test-provider',
      calls: 0,
      async generateContent() {
        this.calls += 1;
        if (this.calls === 1) {
          return {
            content: '',
            tool_calls: [
              { id: 'call-resume-mw-1', name: 'resume_write_tool', arguments: { text: 'approved' } }
            ]
          };
        }
        return { content: 'resume middleware final' };
      }
    };
    const runtimeOptions = {
      agentDef: spec.agentDef,
      provider,
      tools: spec.tools ?? [],
      mcpConfigs: [],
      mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
      toolRegistry,
      messages,
      silent: true
    };

    await engine.prepareRun(spec);
    await engine.run(spec, { runtimeOptions });
    let session = await engine.getSessionByRunId(spec.runId);

    const resumed = await engine.resume(spec.sessionId, {
      decision: {
        permissionId: session!.pendingPermission!.permissionId,
        effect: 'allow',
        resolvedBy: 'human',
        resolvedAt: new Date().toISOString()
      },
      runtimeOptions: {
        ...runtimeOptions,
        messages: messages.map((message) => ({ ...message }))
      },
      middleware: [
        {
          name: 'resume-test-middleware',
          beforeFinish: (ctx) => {
            ctx.metadata.resumeMiddlewareApplied = true;
            ctx.output.metadata = {
              ...ctx.output.metadata,
              resumeMiddlewareOutput: true
            };
          }
        }
      ]
    });
    session = await engine.getSessionByRunId(spec.runId);

    expect(resumed.metadata).toMatchObject({
      resumeMiddlewareOutput: true,
      middleware: {
        resumeMiddlewareApplied: true
      }
    });
    expect(session?.output?.metadata).toMatchObject({
      resumeMiddlewareOutput: true,
      middleware: {
        resumeMiddlewareApplied: true
      }
    });
    expect(session?.status).toBe('succeeded');
  });

  it('does not let late permission resolution reopen cancelling state', async () => {
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = createSpec('late_permission');

    await engine.prepareRun(spec);
    await engine.recordExternalEvent({
      id: 'permission_required_1',
      type: 'permission_required',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        permissionId: 'permission-1',
        runId: spec.runId,
        sessionId: spec.sessionId,
        subject: { toolName: 'dangerous_tool' },
        requestedAt: new Date().toISOString()
      }
    });
    await engine.cancelRun(spec.runId, 'manual');
    await engine.recordExternalEvent({
      id: 'permission_resolved_late',
      type: 'permission_resolved',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        permissionId: 'permission-1',
        effect: 'allow',
        resolvedAt: new Date().toISOString()
      }
    });

    const session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);

    expect(session?.status).toBe('cancelled');
    expect(run?.status).toBe('cancelled');
    expect(session?.pendingPermission).toBeUndefined();
    expect(run?.pendingPermission).toBeUndefined();
  });

  it('does not save late permission checkpoints after cancellation', async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(new InMemoryAgentEventBus(), sessionStore, registry);
    const spec = createSpec('late_checkpoint');

    await engine.prepareRun(spec);
    await engine.cancelRun(spec.runId, 'manual');
    await sessionStore.saveCheckpoint(spec.sessionId, {
      checkpointId: 'checkpoint-late',
      runId: spec.runId,
      sessionId: spec.sessionId,
      reason: 'permission',
      status: 'paused',
      messages: [],
      pendingPermission: {
        permissionId: 'permission-late',
        runId: spec.runId,
        sessionId: spec.sessionId,
        subject: { toolName: 'dangerous_tool' },
        requestedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    });

    const session = await engine.getSessionByRunId(spec.runId);

    expect(session?.status).toBe('cancelled');
    expect(session?.checkpoints).toHaveLength(0);
    expect(session?.pendingPermission).toBeUndefined();
    expect(session?.metadata?.runControl).toMatchObject({
      lastRejectedTransition: {
        from: 'cancelled',
        to: 'paused',
        trigger: 'checkpoint_status'
      }
    });
  });

  it('keeps later runs queued until a process-level execution slot is released', async () => {
    const queue = new AgentRunQueueManager({ maxConcurrentRuns: 1 });
    const first = createSpec('queue_first');
    const second = createSpec('queue_second');

    const firstLease = await queue.acquire(first);
    const secondLeasePromise = queue.acquire(second);
    let secondAcquired = false;
    secondLeasePromise.then(() => {
      secondAcquired = true;
    });
    await Promise.resolve();

    expect(queue.snapshot).toMatchObject({
      maxConcurrentRuns: 1,
      activeRuns: 1,
      queuedRuns: 1
    });
    expect(firstLease.queued).toBe(false);
    expect(secondAcquired).toBe(false);

    firstLease.release();
    const secondLease = await secondLeasePromise;

    expect(secondLease.queued).toBe(true);
    expect(queue.snapshot).toMatchObject({ activeRuns: 1, queuedRuns: 0 });

    secondLease.release();
    expect(queue.snapshot).toMatchObject({ activeRuns: 0, queuedRuns: 0 });
  });

  it('removes cancelled queued runs without consuming the next execution slot', async () => {
    const queue = new AgentRunQueueManager({ maxConcurrentRuns: 1 });
    const first = createSpec('queue_cancel_first');
    const second = createSpec('queue_cancel_second');
    const third = createSpec('queue_cancel_third');

    const firstLease = await queue.acquire(first);
    const secondLeasePromise = queue.acquire(second);
    const thirdLeasePromise = queue.acquire(third);
    await Promise.resolve();

    expect(queue.snapshot).toMatchObject({ activeRuns: 1, queuedRuns: 2 });
    expect(queue.cancel(second.runId)).toBe(true);
    await expect(secondLeasePromise).rejects.toThrow('Agent run queue wait aborted');
    expect(queue.snapshot).toMatchObject({ activeRuns: 1, queuedRuns: 1 });

    firstLease.release();
    const thirdLease = await thirdLeasePromise;

    expect(thirdLease.runId).toBe(third.runId);
    expect(thirdLease.queued).toBe(true);
    expect(queue.snapshot).toMatchObject({ activeRuns: 1, queuedRuns: 0 });

    thirdLease.release();
    expect(queue.snapshot).toMatchObject({ activeRuns: 0, queuedRuns: 0 });
  });

  it('routes resume through the same runtime queue metadata boundary', async () => {
    let resumeOptions: any;
    const engine = {
      resume: async (_sessionId: string, options: any) => {
        resumeOptions = options;
        return {
          content: 'resumed',
          stopReason: 'final'
        };
      }
    } as ReActAgentEngine;
    const queue = new AgentRunQueueManager({ maxConcurrentRuns: 1 });
    const runtimeManager = new AgentRuntimeManager(engine, queue);
    const activeLease = await queue.acquire(createSpec('resume_queue_active'));
    const spec = createSpec('resume_queue_waiting');
    const resumePromise = runtimeManager.resume({
      sessionId: spec.sessionId,
      decision: {
        permissionId: 'permission-1',
        effect: 'allow',
        resolvedAt: new Date().toISOString()
      },
      runSpec: spec,
      provider: {
        name: 'test-provider',
        generateContent: async () => ({ content: 'unused' })
      } as any,
      runtimeOptions: {
        agentDef: {
          id: 'resume-agent',
          name: 'Resume Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: []
        } as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: []
      }
    });

    await Promise.resolve();
    expect(queue.snapshot).toMatchObject({ activeRuns: 1, queuedRuns: 1 });

    activeLease.release();
    await expect(resumePromise).resolves.toMatchObject({ content: 'resumed' });
    expect(resumeOptions).toMatchObject({
      metadata: {
        runQueue: {
          queued: true
        }
      }
    });
    expect(queue.snapshot).toMatchObject({ activeRuns: 0, queuedRuns: 0 });
  });

  it('resumes non-permission HITL input on the same run and persists resume message history', async () => {
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = createSpec('hitl_input_resume');
    const provider = {
      name: 'test-provider',
      seenPrompts: [] as AIMessage[][],
      async generateContent(prompt: AIMessage[]) {
        this.seenPrompts.push(prompt);
        return { content: 'input resumed' };
      }
    };

    await engine.prepareRun(spec);
    await engine.recordExternalEvent({
      id: 'hitl-required-input',
      type: 'hitl_required',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        requestId: 'hitl-input-1',
        kind: 'needs_input',
        status: 'pending',
        prompt: 'Need user input',
        allowedActions: ['provide_input'],
        checkpointId: 'checkpoint-hitl-input-1'
      }
    });
    await engine.recordExternalEvent({
      id: 'run-paused-input',
      type: 'run_paused',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'paused',
        reason: 'needs_input',
        checkpointId: 'checkpoint-hitl-input-1'
      }
    });

    const resumed = await engine.resumeHitl(spec.sessionId, {
      resolution: {
        requestId: 'hitl-input-1',
        kind: 'needs_input',
        status: 'resolved',
        action: 'provide_input',
        input: 'human answer',
        resolvedAt: new Date().toISOString(),
        resolvedBy: { type: 'user' }
      },
      runtimeOptions: {
        agentDef: {
          id: 'hitl-agent',
          name: 'HITL Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: [],
          runtime: { mode: 'react', maxRounds: 1 }
        } as any,
        provider: provider as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: [{ role: 'user', content: 'original prompt' }]
      }
    });

    const session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);
    const eventTypes = (await engine.getEvents(spec.runId)).map((event) => event.type);
    const resumeMessage = session?.messages.at(-1);

    expect(resumed).toMatchObject({ content: 'input resumed', stopReason: 'final' });
    expect(session?.status).toBe('succeeded');
    expect(run?.status).toBe('succeeded');
    expect(session?.pendingHitl).toBeUndefined();
    expect(resumeMessage).toMatchObject({
      role: 'user',
      metadata: { source: 'hitl_resume' }
    });
    expect(String(resumeMessage?.content)).toContain('human answer');
    expect(provider.seenPrompts.at(-1)?.at(-1)).toMatchObject({
      role: 'user',
      content: expect.stringContaining('human answer')
    });
    expect(eventTypes).toContain('hitl_resolved');
    expect(eventTypes).toContain('run_resumed');
    expect(eventTypes.at(-1)).toBe('run_finished');
  });

  it('resumes external HITL tool results on the same run as a tool observation', async () => {
    const eventBus = new InMemoryAgentEventBus();
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(eventBus, sessionStore, registry);
    const spec = createSpec('hitl_external_resume');
    const provider = {
      name: 'test-provider',
      seenPrompts: [] as AIMessage[][],
      async generateContent(prompt: AIMessage[]) {
        this.seenPrompts.push(prompt);
        return { content: 'external resumed' };
      }
    };

    await engine.prepareRun(spec);
    await engine.recordExternalEvent({
      id: 'hitl-required-external',
      type: 'hitl_required',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        requestId: 'hitl-external-1',
        kind: 'external_execution',
        status: 'pending',
        prompt: 'Run externally',
        allowedActions: ['external_result'],
        metadata: {
          toolCallId: 'tool-call-1',
          toolName: 'external_tool'
        }
      }
    });
    await engine.recordExternalEvent({
      id: 'run-paused-external',
      type: 'run_paused',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: 'paused',
        reason: 'external_execution'
      }
    });

    const resumed = await engine.resumeHitl(spec.sessionId, {
      resolution: {
        requestId: 'hitl-external-1',
        kind: 'external_execution',
        status: 'resolved',
        action: 'external_result',
        externalResult: { ok: true, value: 42 },
        resolvedAt: new Date().toISOString(),
        resolvedBy: { type: 'user' }
      },
      runtimeOptions: {
        agentDef: {
          id: 'hitl-agent',
          name: 'HITL Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: [],
          runtime: { mode: 'react', maxRounds: 1 }
        } as any,
        provider: provider as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: [{ role: 'user', content: 'original prompt' }]
      }
    });

    const session = await engine.getSessionByRunId(spec.runId);
    const resumeMessage = session?.messages.at(-1);

    expect(resumed).toMatchObject({ content: 'external resumed', stopReason: 'final' });
    expect(session?.status).toBe('succeeded');
    expect(session?.pendingHitl).toBeUndefined();
    expect(resumeMessage).toMatchObject({
      role: 'tool',
      name: 'external_tool',
      toolCallId: 'tool-call-1',
      metadata: { source: 'hitl_resume' }
    });
    expect(provider.seenPrompts.at(-1)?.at(-1)).toMatchObject({
      role: 'tool',
      name: 'external_tool',
      tool_call_id: 'tool-call-1',
      content: expect.stringContaining('42')
    });
  });

  it('routes HITL resume through the same runtime queue metadata boundary', async () => {
    let resumeHitlOptions: any;
    const engine = {
      resumeHitl: async (_sessionId: string, options: any) => {
        resumeHitlOptions = options;
        return {
          content: 'hitl resumed',
          stopReason: 'final'
        };
      }
    } as ReActAgentEngine;
    const queue = new AgentRunQueueManager({ maxConcurrentRuns: 1 });
    const runtimeManager = new AgentRuntimeManager(engine, queue);
    const activeLease = await queue.acquire(createSpec('hitl_resume_queue_active'));
    const spec = createSpec('hitl_resume_queue_waiting');
    const resumePromise = runtimeManager.resumeHitl({
      sessionId: spec.sessionId,
      resolution: {
        requestId: 'hitl-queue-1',
        kind: 'needs_input',
        status: 'resolved',
        action: 'provide_input',
        input: 'queued answer',
        resolvedAt: new Date().toISOString()
      },
      runSpec: spec,
      provider: {
        name: 'test-provider',
        generateContent: async () => ({ content: 'unused' })
      } as any,
      runtimeOptions: {
        agentDef: {
          id: 'resume-hitl-agent',
          name: 'Resume HITL Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: []
        } as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: []
      }
    });

    await Promise.resolve();
    expect(queue.snapshot).toMatchObject({ activeRuns: 1, queuedRuns: 1 });

    activeLease.release();
    await expect(resumePromise).resolves.toMatchObject({ content: 'hitl resumed' });
    expect(resumeHitlOptions).toMatchObject({
      metadata: {
        runQueue: {
          queued: true
        }
      }
    });
    expect(queue.snapshot).toMatchObject({ activeRuns: 0, queuedRuns: 0 });
  });

  it('routes service-level non-permission HITL decisions through runtime manager resumeHitl', async () => {
    const service = new AgentService(
      {
        getAgent: async () => ({
          id: 'agent-1',
          name: 'Agent One',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: [],
          runtime: { mode: 'react', maxRounds: 1 }
        }),
        get: async () => ({ AI_PROVIDERS: [], CLOSED_PLUGINS: [] }),
        put: async () => undefined,
        getMCPConfig: async () => undefined
      } as any,
      { name: 'test-provider', generateContent: async () => ({ content: 'unused' }) } as any,
      { listSkillMetadata: () => [] } as any,
      { getTools: async () => [], callTool: async () => ({}) } as any
    );
    const session = {
      runId: 'run-service-hitl',
      sessionId: 'session-service-hitl',
      source: 'agent' as const,
      status: 'paused' as const,
      messages: [{ role: 'user' as const, content: 'original' }],
      events: [],
      checkpoints: [
        {
          checkpointId: 'checkpoint-service-hitl',
          runId: 'run-service-hitl',
          sessionId: 'session-service-hitl',
          status: 'paused' as const,
          messages: [{ role: 'user' as const, content: 'checkpoint original' }],
          createdAt: new Date().toISOString()
        }
      ],
      artifacts: [],
      pendingHitl: {
        requestId: 'hitl-service-1',
        kind: 'needs_input' as const,
        status: 'pending' as const,
        prompt: 'Need input',
        allowedActions: ['provide_input' as const]
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        agentId: 'agent-1',
        noTools: true,
        workspacePolicy: { mode: 'local' }
      }
    };
    const resumeHitl = vi
      .fn()
      .mockResolvedValue({ content: 'service hitl resumed', stopReason: 'final' });
    (service as any).agentEngine = {
      getSessionByRunId: vi.fn().mockResolvedValue(session)
    };
    vi.spyOn(service as any, 'buildResumeRuntimeContext').mockResolvedValue({
      runSpec: createSpec('service_hitl_resume'),
      provider: {
        name: 'test-provider',
        generateContent: async () => ({ content: 'unused' })
      } as any,
      runtimeOptions: {
        agentDef: {
          id: 'agent-1',
          name: 'Agent One',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: []
        } as any,
        tools: [],
        mcpConfigs: [],
        mcpService: { getTools: async () => [], callTool: async () => ({}) } as any,
        toolRegistry: ToolRegistry.getInstance(),
        messages: []
      }
    });
    (service as any).runtimeManager = { resumeHitl };

    await expect(
      service.resolveRunHitl({
        runId: 'run-service-hitl',
        requestId: 'hitl-service-1',
        action: 'provide_input',
        input: 'service answer'
      })
    ).resolves.toMatchObject({ content: 'service hitl resumed' });

    expect(resumeHitl).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-service-hitl',
        resolution: expect.objectContaining({
          requestId: 'hitl-service-1',
          action: 'provide_input',
          input: 'service answer'
        }),
        metadata: expect.objectContaining({
          agentId: 'agent-1',
          resume: expect.objectContaining({
            checkpointId: 'checkpoint-service-hitl',
            hitlRequestId: 'hitl-service-1',
            hitlAction: 'provide_input'
          })
        })
      })
    );
  });

  it('restores provider governance ledger when building resume runtime context', async () => {
    const providerCalls: AIMessage[][] = [];
    const service = new AgentService(
      {
        getAgent: async () => ({
          id: 'agent-ledger',
          name: 'Ledger Agent',
          description: '',
          systemPrompt: '',
          providerId: 'test',
          model: 'test-model',
          temperature: 0,
          toolIds: [],
          skillIds: [],
          mcpServerIds: [],
          runtime: { mode: 'react', maxRounds: 2 }
        }),
        get: async () => ({ AI_PROVIDERS: [], CLOSED_PLUGINS: [] }),
        put: async () => undefined,
        getMCPConfig: async () => undefined
      } as any,
      {
        name: 'test-provider',
        async generateContent(messages: AIMessage[]) {
          providerCalls.push(messages);
          return {
            content: 'ledger resumed',
            usage: {
              prompt_tokens: 7,
              completion_tokens: 3,
              total_tokens: 10,
              estimated_cost_usd: 0.02
            }
          };
        }
      } as any,
      { listSkillMetadata: () => [] } as any,
      { getTools: async () => [], callTool: async () => ({}) } as any
    );
    const session = {
      runId: 'run-ledger-resume',
      sessionId: 'session-ledger-resume',
      source: 'agent' as const,
      status: 'paused' as const,
      messages: [{ role: 'user' as const, content: 'resume with ledger' }],
      events: [
        {
          id: 'prior-model-finished',
          type: 'model_finished' as const,
          runId: 'run-ledger-resume',
          sessionId: 'session-ledger-resume',
          timestamp: new Date().toISOString(),
          payload: {
            content: 'prior model call',
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
              estimated_cost_usd: 0.01
            },
            budget: {
              modelCalls: 1,
              inputTokens: 10,
              outputTokens: 5,
              estimatedCostUsd: 0.01
            }
          }
        }
      ],
      checkpoints: [
        {
          checkpointId: 'checkpoint-ledger-resume',
          runId: 'run-ledger-resume',
          sessionId: 'session-ledger-resume',
          status: 'paused' as const,
          messages: [{ role: 'user' as const, content: 'checkpoint resume with ledger' }],
          createdAt: new Date().toISOString()
        }
      ],
      artifacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        agentId: 'agent-ledger',
        noTools: true,
        budgetPolicy: {
          maxModelCalls: 3,
          maxInputTokens: 100,
          maxOutputTokens: 100,
          maxCostUsd: 1,
          providerGovernance: { enabled: true }
        }
      }
    };

    const resumeContext = await (service as any).buildResumeRuntimeContext(session);
    const response = await resumeContext.provider.generateContent(
      [{ role: 'user', content: 'continue' }],
      []
    );
    const governance = response.usage?.governance as any;

    expect(providerCalls).toHaveLength(1);
    expect(governance.budget.cumulative).toMatchObject({
      modelCalls: 2,
      promptTokens: 17,
      completionTokens: 8,
      totalTokens: 25
    });
    expect(governance.budget.cumulative.estimatedCostUsd).toBeCloseTo(0.03);
    expect(governance.budget.limits).toMatchObject({
      maxModelCalls: 3,
      maxInputTokens: 100,
      maxOutputTokens: 100,
      maxCostUsd: 1
    });
  });

  it('uses a single run status transition matrix for legal and illegal lifecycle moves', () => {
    const allowed = [
      ['queued', 'running'],
      ['queued', 'cancelling'],
      ['running', 'paused'],
      ['paused', 'running'],
      ['running', 'cancelling'],
      ['paused', 'cancelling'],
      ['cancelling', 'cancelled'],
      ['running', 'succeeded'],
      ['running', 'failed'],
      ['succeeded', 'archived'],
      ['failed', 'archived'],
      ['cancelled', 'archived']
    ] as const;
    const rejected = [
      ['succeeded', 'running'],
      ['failed', 'running'],
      ['cancelled', 'running'],
      ['archived', 'queued'],
      ['queued', 'paused'],
      ['succeeded', 'cancelling']
    ] as const;

    for (const [from, to] of allowed) {
      expect(evaluateRunStatusTransition(from, to, 'manual_status_update')).toMatchObject({
        accepted: true,
        from,
        to
      });
    }
    for (const [from, to] of rejected) {
      expect(evaluateRunStatusTransition(from, to, 'manual_status_update')).toMatchObject({
        accepted: false,
        from,
        to,
        reason: expect.stringContaining(`${from} -> ${to}`)
      });
    }
  });

  it('records rejected late lifecycle events in both run and session projections', async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    const registry = new InMemoryAgentRunRegistry();
    const engine = new ReActAgentEngine(new InMemoryAgentEventBus(), sessionStore, registry);
    const spec = createSpec('late_lifecycle_event');

    await engine.prepareRun(spec);
    await engine.cancelRun(spec.runId, 'manual');
    await engine.recordExternalEvent({
      id: 'run-started-late',
      type: 'run_started',
      runId: spec.runId,
      sessionId: spec.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        source: 'api',
        status: 'running'
      }
    });

    const session = await engine.getSessionByRunId(spec.runId);
    const run = await registry.get(spec.runId);

    expect(session?.status).toBe('cancelled');
    expect(run?.status).toBe('cancelled');
    expect(session?.metadata?.runControl).toMatchObject({
      lastRejectedTransition: {
        from: 'cancelled',
        to: 'running',
        trigger: 'run_started'
      }
    });
    expect(run?.metadata?.runControl).toMatchObject({
      lastRejectedTransition: {
        from: 'cancelled',
        to: 'running',
        trigger: 'run_started'
      }
    });
  });
});

describe('AgentService pi-context-v2 control plane', () => {
  function createPiContextAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
    return {
      id: 'pi-context-agent',
      name: 'Pi Context Agent',
      description: '',
      systemPrompt: 'You are a pi context test agent.',
      providerId: 'test',
      model: 'test-model',
      temperature: 0,
      toolIds: [],
      skillIds: [],
      mcpServerIds: [],
      runtime: { mode: 'react', maxRounds: 1, returnTrace: true },
      ...overrides
    };
  }

  function createPiContextService(agent: AgentDefinition = createPiContextAgent()) {
    const provider = {
      name: 'test-provider',
      seenPrompts: [] as Array<string | AIMessage[]>,
      seenSystemInstructions: [] as Array<string | undefined>,
      async generateContent(
        prompt: string | AIMessage[],
        _tools: unknown[],
        systemInstruction?: string
      ) {
        this.seenPrompts.push(prompt);
        this.seenSystemInstructions.push(systemInstruction);
        return { content: 'pi context ok' };
      }
    };
    const service = new AgentService(
      {
        getAgent: async () => agent,
        get: async () => ({ AI_PROVIDERS: [], CLOSED_PLUGINS: [] }),
        put: async () => undefined,
        getMCPConfig: async () => undefined
      } as any,
      provider as any,
      { listSkillMetadata: () => [] } as any,
      { getTools: async () => [], callTool: async () => ({}) } as any
    );
    return { service, provider };
  }

  it('marks new runs as pi-context-v2 and keeps retrieved knowledge out of persisted messages', async () => {
    const { service } = createPiContextService();
    let capturedSpec: AgentRunSpec | undefined;
    const runtimeRun = vi
      .spyOn((service as any).runtimeManager, 'run')
      .mockResolvedValue({ content: 'pi context ok', stopReason: 'final' });
    vi.spyOn(service as any, 'assembleTurnContext').mockResolvedValue(
      createTurnContext({
        turnId: 'turn-persisted',
        sources: [
          {
            source: 'knowledge',
            content: '<retrieved_knowledge>secret evidence</retrieved_knowledge>'
          }
        ]
      })
    );

    await service.runAgent('pi-context-agent', 'find evidence', undefined, {
      silent: true,
      onRunCreated: (spec) => {
        capturedSpec = spec;
      }
    });

    const runSpec = runtimeRun.mock.calls[0]?.[0]?.runSpec as AgentRunSpec;
    const runtimeOptions = runtimeRun.mock.calls[0]?.[0]?.runtimeOptions;

    expect(capturedSpec?.metadata?.contextProtocolVersion).toBe(PI_CONTEXT_PROTOCOL_VERSION);
    expect(runSpec.metadata?.contextProtocolVersion).toBe(PI_CONTEXT_PROTOCOL_VERSION);
    expect(runSpec.input.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('<retrieved_knowledge>')
        })
      ])
    );
    expect(runtimeOptions?.context?.sessionContext?.protocolVersion).toBe(PI_CONTEXT_PROTOCOL_VERSION);
    expect(runtimeOptions?.context?.turnContext?.sources[0]?.content).toContain(
      '<retrieved_knowledge>'
    );
    expect(runtimeOptions?.context?.contextTransformer).toBeDefined();
  });

  it('rebuilds resumed permission runtime with session and turn context hooks', async () => {
    const { service } = createPiContextService();
    const session = {
      runId: 'run-pi-resume',
      sessionId: 'session-pi-resume',
      source: 'agent' as const,
      status: 'paused' as const,
      messages: [{ role: 'user' as const, content: 'resume with evidence' }],
      events: [],
      checkpoints: [
        {
          checkpointId: 'checkpoint-pi-resume',
          runId: 'run-pi-resume',
          sessionId: 'session-pi-resume',
          status: 'paused' as const,
          messages: [{ role: 'user' as const, content: 'resume with evidence' }],
          createdAt: new Date().toISOString()
        }
      ],
      artifacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        agentId: 'pi-context-agent',
        noTools: true,
        contextProtocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
        turnId: 'turn-resume',
        context: {
          contextProtocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
          turnId: 'turn-resume',
          retrieval: { memoryEnabled: true }
        }
      }
    };
    vi.spyOn(service as any, 'assembleTurnContext').mockResolvedValue(
      createTurnContext({
        turnId: 'turn-resume',
        sources: [
          {
            source: 'knowledge',
            content: '<retrieved_knowledge>resumed evidence</retrieved_knowledge>'
          }
        ]
      })
    );

    const resumeContext = await (service as any).buildResumeRuntimeContext(session);

    expect(resumeContext.runtimeOptions.context?.sessionContext?.protocolVersion).toBe(
      PI_CONTEXT_PROTOCOL_VERSION
    );
    expect(resumeContext.runtimeOptions.context?.turnContext?.turnId).toBe('turn-resume');
    expect(resumeContext.runtimeOptions.context?.contextTransformer).toBeDefined();
    expect(resumeContext.runtimeOptions.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('<retrieved_knowledge>')
        })
      ])
    );
  });

  it('rejects unsupported stored context protocol versions on resume', async () => {
    const { service } = createPiContextService();
    await expect(
      (service as any).buildResumeRuntimeContext({
        runId: 'run-legacy-protocol',
        sessionId: 'session-legacy-protocol',
        source: 'agent',
        status: 'paused',
        messages: [{ role: 'user', content: 'resume' }],
        events: [],
        checkpoints: [],
        artifacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          agentId: 'pi-context-agent',
          context: { contextProtocolVersion: 'legacy-context-v1' }
        }
      })
    ).rejects.toMatchObject({ code: 'context_version_unsupported' });
  });
});
