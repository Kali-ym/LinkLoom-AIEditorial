import fs from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { BaseTool } from '../src/plugins/base/BaseTool.js';
import { AgentService } from '../src/services/agents/AgentService.js';
import { AGENT_EVENT_SCHEMA_VERSION, type AgentEvent } from '../src/services/agents/engine/AgentEvent.js';
import { createAgentEventLegacyStreamAdapter } from '../src/services/agents/engine/AgentEventStreamAdapter.js';
import { mapStreamChunkToAgentEvents } from '../src/services/agents/engine/AgentEventMapper.js';
import { InMemoryAgentEventBus } from '../src/services/agents/engine/EventBus.js';
import { ReActAgentEngine } from '../src/services/agents/engine/ReActAgentEngine.js';
import { InMemoryAgentRunRegistry } from '../src/services/agents/engine/AgentRunRegistry.js';
import type { AgentDefinition } from '../src/types/agent.js';
import type { AIMessage, AIResponse } from '../src/types/index.js';

class AgentStreamEchoTool extends BaseTool {
  readonly id = 'agent_stream_echo';
  readonly name = 'agent_stream_echo';
  readonly description = 'Echoes text for stream agent tests';
  readonly parameters = {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  };

  async handler(args: { text?: string }) {
    return { echoed: args.text || '' };
  }
}

class AgentStreamAbortWaitTool extends BaseTool {
  readonly id = 'agent_stream_wait_abort';
  readonly name = 'agent_stream_wait_abort';
  readonly description = 'Waits until its execution signal is aborted';
  readonly parameters = {
    type: 'object',
    properties: {}
  };

  async handler(_args: unknown, ctx?: { signal?: AbortSignal }) {
    if (!ctx?.signal) throw new Error('missing abort signal');
    if (ctx.signal.aborted) throw new Error('aborted before tool start');
    await new Promise<void>((resolve) => {
      ctx.signal?.addEventListener('abort', () => resolve(), { once: true });
    });
    throw new Error('tool observed abort');
  }
}

function createAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'stream-agent',
    name: 'Stream Agent',
    description: 'stream test agent',
    systemPrompt: 'You are a streaming test agent.',
    providerId: 'test',
    model: 'test-model',
    temperature: 0,
    toolIds: ['agent_stream_echo'],
    skillIds: [],
    mcpServerIds: [],
    runtime: {
      mode: 'react',
      maxRounds: 3,
      returnTrace: true,
      maxRepeatedToolErrors: 2,
      stopOnRepeatedToolError: true
    },
    ...overrides
  };
}

function createStore(agent: AgentDefinition) {
  return {
    getAgent: vi.fn().mockResolvedValue(agent),
    get: vi.fn().mockResolvedValue({ AI_PROVIDERS: [], CLOSED_PLUGINS: [] }),
    put: vi.fn().mockResolvedValue(undefined),
    getMCPConfig: vi.fn().mockResolvedValue(undefined)
  };
}

function createProvider(rounds: AIResponse[][]) {
  let index = 0;
  const seenTools: unknown[] = [];
  const seenPrompts: unknown[] = [];
  return {
    name: 'test-provider',
    seenTools,
    seenPrompts,
    async generateContent() {
      return { content: '' };
    },
    async *streamContent(prompt: string | AIMessage[], tools: unknown[]) {
      seenPrompts.push(prompt);
      seenTools.push(tools);
      const chunks = rounds[index] || rounds[rounds.length - 1];
      index += 1;
      for (const chunk of chunks) yield chunk;
    }
  };
}

function createService(
  agent: AgentDefinition,
  provider: any,
  skillMetadata: { id: string; name: string; description: string }[] = [],
  runRegistry?: InMemoryAgentRunRegistry
) {
  const registry = ToolRegistry.getInstance();
  registry.registerTool(new AgentStreamEchoTool());
  registry.registerTool(new AgentStreamAbortWaitTool());
  return {
    service: new AgentService(
      createStore(agent) as any,
      provider,
      { listSkillMetadata: vi.fn().mockReturnValue(skillMetadata) } as any,
      { getTools: vi.fn().mockResolvedValue([]), callTool: vi.fn() } as any,
      undefined,
      runRegistry
    ),
    registry
  };
}

async function collect(iterable: AsyncIterable<any>) {
  const events: any[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe('AgentService streamAgent', () => {
  it('normalizes tool arguments and emits trace observations before final trace', async () => {
    const provider = createProvider([
      [
        {
          content: '',
          tool_calls: [{ id: 'call-1', name: 'agent_stream_echo', arguments: '{"text":"hello"}' }]
        }
      ],
      [{ content: 'done' }]
    ]);
    const { service } = createService(createAgent(), provider);

    const events = await collect(
      service.streamAgent('stream-agent', 'run', undefined, { silent: true })
    );

    expect(events.map((event) => event.type)).toEqual([
      'round_start',
      'tool_calls_delta',
      'trace_round',
      'tool_calls',
      'tool_start',
      'tool_result',
      'trace_observation',
      'round_start',
      'content',
      'final_content',
      'final_trace'
    ]);
    expect(events.find((event) => event.type === 'tool_start')).toMatchObject({
      tool: 'agent_stream_echo',
      args: { text: 'hello' }
    });
    expect(events.find((event) => event.type === 'trace_observation').observation).toMatchObject({
      toolName: 'agent_stream_echo',
      success: true,
      data: { echoed: 'hello' }
    });
    expect(events.at(-1)).toMatchObject({ type: 'final_trace', stopReason: 'final' });
  });

  it('assigns AgentEvent v1 sequence to lifecycle events at publish boundary', async () => {
    const eventBus = new InMemoryAgentEventBus();
    await eventBus.publish({
      id: 'event-run-started',
      type: 'run_started',
      runId: 'run-sequence',
      sessionId: 'session-sequence',
      timestamp: '2026-01-01T00:00:00.000Z',
      payload: {
        source: 'agent',
        status: 'running',
        agentId: 'stream-agent'
      }
    });
    await eventBus.publish({
      id: 'event-hitl-required',
      type: 'hitl_required',
      runId: 'run-sequence',
      sessionId: 'session-sequence',
      timestamp: '2026-01-01T00:00:01.000Z',
      payload: {
        requestId: 'hitl-1',
        kind: 'confirmation',
        status: 'pending',
        allowedActions: ['allow', 'deny']
      }
    });
    await eventBus.publish({
      id: 'event-run-finished',
      type: 'run_finished',
      runId: 'run-sequence',
      sessionId: 'session-sequence',
      timestamp: '2026-01-01T00:00:02.000Z',
      payload: {
        status: 'succeeded',
        output: { content: 'done', stopReason: 'final' }
      }
    });

    const events = eventBus.getEvents('run-sequence');

    expect(events.map((event) => event.schemaVersion)).toEqual([
      AGENT_EVENT_SCHEMA_VERSION,
      AGENT_EVENT_SCHEMA_VERSION,
      AGENT_EVENT_SCHEMA_VERSION
    ]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(events.map((event) => event.traceId)).toEqual([
      'run-sequence',
      'run-sequence',
      'run-sequence'
    ]);
    expect(events.map((event) => event.correlationId)).toEqual([
      'run-sequence',
      'run-sequence',
      'run-sequence'
    ]);
  });

  it('replays legacy stream chunks from saved AgentEvent v1 without leaking platform fields', async () => {
    const provider = createProvider([[{ content: 'replayed answer' }]]);
    const { service } = createService(createAgent(), provider);
    let runId = '';

    const liveChunks = await collect(
      service.streamAgent('stream-agent', 'run', undefined, {
        silent: true,
        onRunCreated: (spec) => {
          runId = spec.runId;
        }
      })
    );

    const savedEvents = await service.getRunEvents(runId);
    const replayedChunks = createAgentEventLegacyStreamAdapter().mapEvents(savedEvents);
    const replayableLiveChunks = liveChunks.filter((chunk) => chunk.type !== 'content');

    expect(savedEvents.every((event) => event.schemaVersion === AGENT_EVENT_SCHEMA_VERSION)).toBe(true);
    expect(savedEvents.every((event) => typeof event.sequence === 'number')).toBe(true);
    expect(replayedChunks).toEqual(replayableLiveChunks);
    for (const chunk of replayedChunks) {
      expect(chunk).not.toHaveProperty('schemaVersion');
      expect(chunk).not.toHaveProperty('sequence');
      expect(chunk).not.toHaveProperty('source');
      expect(chunk).not.toHaveProperty('payload');
      expect(chunk).not.toHaveProperty('metadata');
      expect(chunk).not.toHaveProperty('traceId');
      expect(chunk).not.toHaveProperty('spanId');
      expect(chunk).not.toHaveProperty('correlationId');
    }
  });

  it('keeps provider governance metadata in platform events without changing legacy chunks', async () => {
    const provider = createProvider([
      [
        {
          content: 'governed stream',
          usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 }
        }
      ]
    ]);
    const { service } = createService(createAgent(), provider);
    let runId = '';

    const chunks = await collect(
      service.streamAgent('stream-agent', 'run', undefined, {
        silent: true,
        budgetPolicy: { maxModelCalls: 1 },
        onRunCreated: (spec) => {
          runId = spec.runId;
        }
      })
    );

    expect(chunks.map((chunk) => chunk.type)).toEqual([
      'round_start',
      'content',
      'final_content',
      'final_trace'
    ]);
    for (const chunk of chunks) {
      expect(chunk).not.toHaveProperty('usage');
      expect(chunk).not.toHaveProperty('provider');
      expect(chunk).not.toHaveProperty('budget');
    }
    expect(Object.keys(chunks.find((chunk) => chunk.type === 'final_content')).sort()).toEqual([
      'content',
      'round',
      'type'
    ]);

    const events = await service.getRunEvents(runId);
    const modelFinished = events.find((event) => event.type === 'model_finished');
    expect(modelFinished?.payload).toMatchObject({
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
      provider: { providerName: 'test-provider', model: 'test-model', fallbackUsed: false },
      budget: { modelCalls: 1, inputTokens: 12, outputTokens: 3, exceeded: [] }
    });
  });

  it('keeps sandbox metadata in platform tool traces without changing legacy chunks', () => {
    const platformEvents = mapStreamChunkToAgentEvents(
      {
        type: 'trace_observation',
        round: 1,
        observation: {
          toolCallId: 'call-1',
          toolName: 'agent_stream_echo',
          success: false,
          content: 'Workspace sandbox denied tool execution.',
          error: 'Workspace sandbox denied tool execution.',
          durationMs: 0,
          execution: {
            source: 'local',
            attempts: 0,
            error: {
              code: 'sandbox_denied',
              message: 'Workspace sandbox denied tool execution.',
              retryable: false
            },
            sandbox: {
              effect: 'deny',
              code: 'workspace_mode_none',
              capabilities: ['process.exec']
            }
          }
        }
      },
      { runId: 'run-1', sessionId: 'session-1' }
    );

    const toolFinished = platformEvents.find((event) => event.type === 'tool_finished');
    expect(toolFinished?.payload).toMatchObject({
      execution: {
        source: 'local',
        attempts: 0,
        error: { code: 'sandbox_denied', retryable: false },
        sandbox: { effect: 'deny', code: 'workspace_mode_none' }
      }
    });

    const chunks = createAgentEventLegacyStreamAdapter().mapEvents(platformEvents);
    const observationChunk = chunks.find((chunk) => chunk.type === 'trace_observation');
    expect(observationChunk).toMatchObject({
      type: 'trace_observation',
      round: 1,
      observation: {
        toolCallId: 'call-1',
        toolName: 'agent_stream_echo',
        success: false,
        content: 'Workspace sandbox denied tool execution.',
        error: 'Workspace sandbox denied tool execution.',
        durationMs: 0
      }
    });
    expect(observationChunk).not.toHaveProperty('execution');
    expect(observationChunk).not.toHaveProperty('sandbox');
    expect((observationChunk as any).observation).not.toHaveProperty('execution');
    expect((observationChunk as any).observation).not.toHaveProperty('sandbox');
  });

  it('limits same-round streaming tool requests before execution', async () => {
    const provider = createProvider([
      [
        {
          content: '',
          tool_calls: [
            { id: 'call-1', name: 'agent_stream_echo', arguments: '{"text":"first"}' },
            { id: 'call-2', name: 'agent_stream_echo', arguments: '{"text":"second"}' }
          ]
        }
      ],
      [{ content: 'done' }]
    ]);
    const baseAgent = createAgent();
    const { service } = createService(
      createAgent({
        runtime: {
          ...baseAgent.runtime,
          maxRounds: 2,
          maxToolCallsPerRound: 1
        }
      }),
      provider
    );

    const events = await collect(
      service.streamAgent('stream-agent', 'run', undefined, { silent: true })
    );

    expect(events.filter((event) => event.type === 'tool_start')).toHaveLength(1);
    expect(events.find((event) => event.type === 'tool_calls').tool_calls).toHaveLength(1);
    const observations = events.filter((event) => event.type === 'trace_observation');
    expect(observations).toHaveLength(2);
    expect(observations[0].observation).toMatchObject({
      toolCallId: 'call-1',
      success: true
    });
    expect(observations[1].observation).toMatchObject({
      toolCallId: 'call-2',
      success: false,
      data: expect.objectContaining({ limited: true })
    });
  });

  it('merges streaming argument fragments into one scheduled tool request', async () => {
    const provider = createProvider([
      [
        {
          content: '',
          tool_calls: [{ name: 'agent_stream_echo', arguments: { text: 'he' } }] as any
        },
        {
          content: '',
          tool_calls: [{ name: 'agent_stream_echo', arguments: { text: 'hello' } }] as any
        }
      ],
      [{ content: 'done' }]
    ]);
    const { service } = createService(createAgent(), provider);

    const events = await collect(
      service.streamAgent('stream-agent', 'run', undefined, { silent: true })
    );

    const toolCallEvents = events.filter((event) => event.type === 'tool_calls');
    expect(toolCallEvents).toHaveLength(1);
    expect(toolCallEvents[0].tool_calls).toHaveLength(1);
    expect(toolCallEvents[0].tool_calls[0]).toMatchObject({
      name: 'agent_stream_echo',
      arguments: { text: 'hello' }
    });
    expect(events.filter((event) => event.type === 'tool_start')).toHaveLength(1);
    expect(events.find((event) => event.type === 'tool_start')).toMatchObject({
      tool: 'agent_stream_echo',
      args: { text: 'hello' }
    });
  });

  it('counts only accepted tool requests and counts tool-call rounds in run stats', async () => {
    const provider = createProvider([
      [
        {
          content: '',
          tool_calls: [
            { id: 'call-1', name: 'agent_stream_echo', arguments: '{"text":"first"}' },
            { id: 'call-2', name: 'agent_stream_echo', arguments: '{"text":"second"}' }
          ]
        }
      ],
      [{ content: 'done' }]
    ]);
    const baseAgent = createAgent();
    const runRegistry = new InMemoryAgentRunRegistry();
    const { service } = createService(
      createAgent({
        runtime: {
          ...baseAgent.runtime,
          maxRounds: 2,
          maxToolCallsPerRound: 1
        }
      }),
      provider,
      '',
      runRegistry
    );

    await collect(service.streamAgent('stream-agent', 'run', undefined, { silent: true }));

    const page = await runRegistry.list();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      roundCount: 2,
      toolCallCount: 1
    });
  });

  it('stops repeated invalid arguments with an explicit final_trace stopReason', async () => {
    const provider = createProvider([
      [
        {
          content: '',
          tool_calls: [{ id: 'call-1', name: 'agent_stream_echo', arguments: '{}' }]
        }
      ],
      [
        {
          content: '',
          tool_calls: [{ id: 'call-2', name: 'agent_stream_echo', arguments: '{}' }]
        }
      ]
    ]);
    const { service } = createService(createAgent(), provider);

    const events = await collect(
      service.streamAgent('stream-agent', 'run', undefined, { silent: true })
    );

    expect(events.filter((event) => event.type === 'tool_error')).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({
      type: 'final_trace',
      stopReason: 'invalid_tool_arguments'
    });
  });

  it('finishes running stream cancellation as cancelled without final content or success', async () => {
    const controller = new AbortController();
    const provider = {
      name: 'test-provider',
      async generateContent() {
        return { content: '' };
      },
      async *streamContent() {
        yield {
          content: '',
          tool_calls: [{ id: 'call-cancel', name: 'agent_stream_echo', arguments: '{"text":"stop"}' }]
        };
      }
    };
    const runRegistry = new InMemoryAgentRunRegistry();
    const { service } = createService(createAgent(), provider, [], runRegistry);
    let runId = '';

    const events = await collect(
      service.streamAgent('stream-agent', 'run', undefined, {
        silent: true,
        signal: controller.signal,
        onRunCreated: (spec) => {
          runId = spec.runId;
        },
        middleware: [
          {
            beforeToolCall: () => {
              controller.abort('client_disconnect');
            }
          }
        ]
      })
    );

    expect(events.map((event) => event.type)).not.toContain('final_content');
    expect(events.map((event) => event.type)).not.toContain('run_cancel_requested');
    expect(events.map((event) => event.type)).not.toContain('run_cancelled');
    expect(events.at(-1)).toMatchObject({ type: 'final_trace', stopReason: 'cancelled' });

    const runEvents = await service.getRunEvents(runId);
    expect(runEvents.map((event) => event.type)).toContain('run_cancel_requested');
    expect(runEvents.map((event) => event.type)).toContain('run_cancelled');
    expect(runEvents.map((event) => event.type)).not.toContain('run_failed');
    const page = await runRegistry.list();
    expect(page.items[0]).toMatchObject({ status: 'cancelled' });
  });

  it('passes abort signal into provider streaming calls and stops as cancelled', async () => {
    const controller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    const provider = {
      name: 'test-provider',
      async generateContent() {
        return { content: '' };
      },
      async *streamContent(
        _prompt: string | AIMessage[],
        _tools: unknown[],
        _systemInstruction?: string,
        options?: { signal?: AbortSignal }
      ) {
        providerSignal = options?.signal;
        yield { content: 'partial' };
        controller.abort('client_disconnect');
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        yield { content: 'late' };
      }
    };
    const runRegistry = new InMemoryAgentRunRegistry();
    const { service } = createService(createAgent(), provider, [], runRegistry);
    let runId = '';

    const events = await collect(
      service.streamAgent('stream-agent', 'run', undefined, {
        silent: true,
        signal: controller.signal,
        onRunCreated: (spec) => {
          runId = spec.runId;
        }
      })
    );

    expect(providerSignal).toBeDefined();
    expect(providerSignal?.aborted).toBe(true);
    expect(events.map((event) => event.type)).toEqual([
      'round_start',
      'content',
      'final_trace'
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'final_trace', stopReason: 'cancelled' });
    const runEvents = await service.getRunEvents(runId);
    expect(runEvents.map((event) => event.type)).toContain('run_cancelled');
    const page = await runRegistry.list();
    expect(page.items[0]).toMatchObject({ status: 'cancelled' });
  });

  it('wakes a running streaming tool when the run signal is aborted', async () => {
    const controller = new AbortController();
    const provider = createProvider([
      [
        {
          content: '',
          tool_calls: [{ id: 'call-wait', name: 'agent_stream_wait_abort', arguments: '{}' }]
        }
      ]
    ]);
    const runRegistry = new InMemoryAgentRunRegistry();
    const { service } = createService(
      createAgent({ toolIds: ['agent_stream_wait_abort'] }),
      provider,
      '',
      runRegistry
    );
    let runId = '';

    const events: any[] = [];
    for await (const event of service.streamAgent('stream-agent', 'run', undefined, {
      silent: true,
      signal: controller.signal,
      onRunCreated: (spec) => {
        runId = spec.runId;
      }
    })) {
      events.push(event);
      if (event.type === 'tool_start') {
        controller.abort('client_disconnect');
      }
    }

    expect(events.map((event) => event.type)).toContain('tool_start');
    expect(events.at(-1)).toMatchObject({ type: 'final_trace', stopReason: 'cancelled' });
    const runEvents = await service.getRunEvents(runId);
    expect(runEvents.map((event) => event.type)).toContain('run_cancelled');
    const page = await runRegistry.list();
    expect(page.items[0]).toMatchObject({ status: 'cancelled' });
  });

  it('keeps HITL platform events out of legacy stream chunks', () => {
    const adapter = createAgentEventLegacyStreamAdapter();
    const chunks = adapter.mapEvents([
      {
        id: 'event-hitl-required',
        type: 'hitl_required',
        runId: 'run-1',
        sessionId: 'session-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        payload: {
          requestId: 'hitl-1',
          kind: 'confirmation',
          status: 'pending',
          allowedActions: ['allow', 'deny']
        }
      },
      {
        id: 'event-hitl-resolved',
        type: 'hitl_resolved',
        runId: 'run-1',
        sessionId: 'session-1',
        timestamp: '2026-01-01T00:00:01.000Z',
        payload: {
          requestId: 'hitl-1',
          kind: 'confirmation',
          status: 'resolved',
          action: 'allow'
        }
      }
    ] as any);

    expect(chunks).toEqual([]);
  });

  it('keeps context and artifact platform events out of legacy stream chunks', () => {
    const adapter = createAgentEventLegacyStreamAdapter();
    const chunks = adapter.mapEvents([
      {
        id: 'event-context-compacted',
        type: 'context_compacted',
        runId: 'run-1',
        sessionId: 'session-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        payload: {
          strategy: 'hybrid',
          beforeMessages: 40,
          afterMessages: 12,
          summary: 'summary',
          artifactIds: ['artifact-1']
        }
      },
      {
        id: 'event-artifact-saved',
        type: 'artifact_saved',
        runId: 'run-1',
        sessionId: 'session-1',
        timestamp: '2026-01-01T00:00:01.000Z',
        payload: {
          artifactId: 'artifact-1',
          kind: 'model_output',
          uri: 'file:///tmp/artifact-1.txt',
          preview: 'preview'
        }
      }
    ] as any);

    expect(chunks).toEqual([]);
  });

  it('saves large final streaming output as platform artifact without leaking legacy chunks', async () => {
    const largeContent = 'stream-output-'.repeat(8);
    const provider = createProvider([[{ content: largeContent }]]);
    const runRegistry = new InMemoryAgentRunRegistry();
    const { service } = createService(createAgent(), provider, [], runRegistry);
    let runId = '';

    const chunks = await collect(
      service.streamAgent('stream-agent', 'run', undefined, {
        silent: true,
        contextPolicy: {
          artifactPolicy: {
            enabled: true,
            maxInlineBytes: 8,
            previewBytes: 16
          }
        },
        onRunCreated: (spec) => {
          runId = spec.runId;
        }
      })
    );

    expect(chunks.map((chunk) => chunk.type)).toEqual([
      'round_start',
      'content',
      'final_content',
      'final_trace'
    ]);
    expect(chunks.find((chunk) => chunk.type === 'final_content')).toMatchObject({
      content: largeContent
    });

    const events = await service.getRunEvents(runId);
    expect(events.map((event) => event.type)).toContain('artifact_saved');
    const session = await service.getRunSession(runId);
    expect(session?.artifacts).toHaveLength(1);
    expect(session?.artifacts[0]).toMatchObject({
      kind: 'model_output',
      sizeBytes: Buffer.byteLength(largeContent, 'utf8'),
      metadata: expect.objectContaining({ storage: 'platform' })
    });
    const workspacePath = session?.artifacts[0].metadata?.workspacePath as string | undefined;
    expect(workspacePath).toBeTruthy();
    await expect(fs.readFile(workspacePath as string, 'utf8')).resolves.toBe(largeContent);
  });

  it('respects noTools and noSkills for internal streaming calls', async () => {
    const provider = createProvider([[{ content: 'done' }]]);
    const skillDescription = 'skill instructions';
    const agent = createAgent({ skillIds: ['skill-1'] });
    const { service } = createService(agent, provider, [
      { id: 'skill-1', name: 'Skill 1', description: skillDescription }
    ]);

    await collect(
      service.streamAgent('stream-agent', 'run', undefined, {
        silent: true,
        noTools: true,
        noSkills: true
      })
    );

    expect(provider.seenTools[0]).toEqual([]);
    const firstPrompt = provider.seenPrompts[0] as AIMessage[];
    expect(firstPrompt[0].content).not.toContain(skillDescription);
  });
});

describe('ReActAgentEngine stream event trace', () => {
  it('dedupes repeated tool call request events without hiding distinct calls', async () => {
    const engine = new ReActAgentEngine();
    const runId = 'run_stream_dedupe';
    const sessionId = 'session_stream_dedupe';

    await collect(
      engine.streamChunks(
        {
          runId,
          sessionId,
          source: 'builder',
          input: { messages: [] },
          temporaryAgentDef: createAgent()
        },
        async function* () {
          yield { type: 'round_start', round: 1 };
          yield {
            type: 'tool_calls_delta',
            round: 1,
            tool_calls: [
              { id: 'call-1', name: 'agent_stream_echo', arguments: { text: 'hello' } }
            ]
          };
          yield {
            type: 'tool_calls',
            round: 1,
            tool_calls: [
              { id: 'call-1', name: 'agent_stream_echo', arguments: { text: 'hello' } }
            ]
          };
          yield {
            type: 'tool_calls_delta',
            round: 1,
            tool_calls: [{ name: 'agent_stream_echo', arguments: { text: 'fallback-a' } }]
          };
          yield {
            type: 'tool_calls',
            round: 1,
            tool_calls: [{ name: 'agent_stream_echo', arguments: { text: 'fallback-a' } }]
          };
          yield {
            type: 'tool_calls_delta',
            round: 1,
            tool_calls: [{ name: 'agent_stream_echo', arguments: { text: 'fallback-b' } }]
          };
          yield { type: 'final_content', content: 'done' };
        }
      )
    );

    const events = await engine.getEvents(runId);
    const requests = events.filter((event) => event.type === 'tool_call_requested');

    expect(requests).toHaveLength(2);
    expect(requests.map((event) => event.payload)).toEqual([
      expect.objectContaining({ toolCallId: 'call-1', arguments: { text: 'hello' } }),
      expect.objectContaining({ arguments: { text: 'fallback-a' } })
    ]);
  });

  it('does not persist high-frequency stream deltas as agent_events (ephemeral)', async () => {
    const engine = new ReActAgentEngine();
    const runId = 'run_stream_ephemeral_delta';
    const sessionId = 'session_stream_ephemeral_delta';
    const liveDeltas: AgentEvent[] = [];
    const unsubscribe = engine.subscribe(runId, (event) => {
      if (isEphemeralStreamEventForTest(event)) liveDeltas.push(event);
    });

    try {
      await collect(
        engine.streamChunks(
          {
            runId,
            sessionId,
            source: 'builder',
            input: { messages: [] },
            temporaryAgentDef: createAgent()
          },
          async function* () {
            yield { type: 'round_start', round: 1 };
            for (let i = 0; i < 50; i += 1) {
              yield { type: 'reasoning', content: `think-${i}`, round: 1 };
              yield { type: 'content', content: `tok-${i}`, round: 1 };
              yield {
                type: 'tool_calls_delta',
                round: 1,
                tool_calls: [{ id: 'call-eph', name: 'agent_stream_echo', arguments: { text: `delta-${i}` } }]
              };
            }
            yield {
              type: 'tool_calls',
              round: 1,
              tool_calls: [{ id: 'call-eph', name: 'agent_stream_echo', arguments: { text: 'final' } }]
            };
            yield {
              type: 'final_content',
              content: 'done',
              reasoning: 'full reasoning snapshot',
              round: 1
            };
          }
        )
      );
    } finally {
      unsubscribe();
    }

    const events = await engine.getEvents(runId);
    const customToolDeltas = events.filter(
      (event) => event.type === 'custom' && (event.payload as { name?: string }).name === 'tool_calls_delta'
    );
    const reasoningDeltas = events.filter((event) => event.type === 'reasoning_delta');
    const messageDeltas = events.filter((event) => event.type === 'message_delta');
    const modelDeltas = events.filter((event) => event.type === 'model_delta');
    const requests = events.filter((event) => event.type === 'tool_call_requested');
    const modelFinished = events.filter((event) => event.type === 'model_finished');

    expect(requests).toHaveLength(1);
    expect(requests[0].payload).toMatchObject({ toolCallId: 'call-eph', arguments: { text: 'final' } });
    expect(customToolDeltas).toEqual([]);
    expect(reasoningDeltas).toEqual([]);
    expect(messageDeltas).toEqual([]);
    expect(modelDeltas).toEqual([]);
    expect(modelFinished.some((event) => (event.payload as { reasoning?: string }).reasoning === 'full reasoning snapshot')).toBe(true);
    // Live SSE path: deltas hit the in-process bus but not agent_events.
    expect(liveDeltas.length).toBeGreaterThan(100);
    expect(liveDeltas.every((event) => typeof event.sequence === 'number' && event.sequence < 0)).toBe(true);
  });
});

function isEphemeralStreamEventForTest(event: AgentEvent): boolean {
  if (event.type === 'reasoning_delta' || event.type === 'model_delta' || event.type === 'message_delta') {
    return true;
  }
  if (event.type !== 'custom') return false;
  return (event.payload as { name?: string }).name === 'tool_calls_delta';
}
