import { describe, expect, it, vi } from 'vitest';
import { TokenEstimator } from '../src/services/agents/context/TokenEstimator.js';
import { TokenCounter } from '../src/services/agents/context/TokenCounter.js';
import { ClassifiedMessageBuilder } from '../src/services/agents/context/ClassifiedMessageBuilder.js';
import { ContextTokenCategory } from '../src/services/agents/context/ContextTokenTypes.js';
import { resolveContextProfile } from '../src/services/agents/context/ModelContextProfile.js';
import { ReActRuntime } from '../src/services/agents/runtime/ReActRuntime.js';
import { BaseTool } from '../src/plugins/base/BaseTool.js';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import type { AgentDefinition, ToolDefinition } from '../src/types/agent.js';
import type { AIMessage, AIResponse } from '../src/types/index.js';

describe('context usage snapshot production', () => {
  it('TokenCounter produces snapshot from ClassifiedModelInput', async () => {
    const profile = resolveContextProfile('openai', 'gpt-4o');
    const est = new TokenEstimator({ driftMultiplier: profile.driftMultiplier, encoding: profile.encoding });
    await est.preload();
    const counter = new TokenCounter(est, profile);
    const builder = new ClassifiedMessageBuilder();

    const messages: AIMessage[] = [
      { role: 'system', content: 'You are helpful.\n\n## Available Skills\n\n### Skill: foo\nInstructions:\nDo foo.' },
      { role: 'user', content: 'hello' }
    ];
    const tools = [{ id: 'local_tool', function: { name: 'local_tool', parameters: {} } }];

    const classified = builder.build(messages, tools, new Set());
    const breakdown = counter.count(classified);
    const snapshot = counter.toSnapshot(breakdown, { round: 1 });

    expect(snapshot.byCategory[ContextTokenCategory.SystemPrompt]).toBeGreaterThan(0);
    expect(snapshot.byCategory[ContextTokenCategory.Skills]).toBeGreaterThan(0);
    expect(snapshot.byCategory[ContextTokenCategory.Conversation]).toBeGreaterThan(0);
    expect(snapshot.byCategory[ContextTokenCategory.ToolDefinitions]).toBeGreaterThan(0);
    expect(snapshot.maxContextTokens).toBe(128000);
    expect(snapshot.round).toBe(1);
    expect(snapshot.source).toBe('counter');
  });

  it('onContextUsageMeasured callback receives snapshot', async () => {
    const profile = resolveContextProfile('openai', 'gpt-4o');
    const est = new TokenEstimator({ driftMultiplier: profile.driftMultiplier, encoding: profile.encoding });
    await est.preload();
    const counter = new TokenCounter(est, profile);
    const builder = new ClassifiedMessageBuilder();
    const cb = vi.fn();

    const messages: AIMessage[] = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }];
    const classified = builder.build(messages, [], new Set());
    const breakdown = counter.count(classified);
    const snapshot = counter.toSnapshot(breakdown, { round: 0 });
    cb(snapshot);

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ round: 0 }));
  });
});

class ContextUsageEchoTool extends BaseTool {
  readonly id = 'context_usage_echo';
  readonly name = 'context_usage_echo';
  readonly description = 'Echoes input for context usage timing tests';
  readonly parameters = {
    type: 'object' as const,
    properties: { text: { type: 'string' } },
    required: ['text']
  };

  async handler(args: { text?: string }) {
    return { echoed: args.text || '' };
  }
}

function createContextUsageProvider(responses: AIResponse[]) {
  let index = 0;
  return {
    name: 'test-provider',
    async generateContent(_prompt: string | AIMessage[], _tools: ToolDefinition[]) {
      const response = responses[index] || responses[responses.length - 1];
      index += 1;
      return response;
    },
    async *streamContent(_prompt: string | AIMessage[], _tools: ToolDefinition[]) {
      const response = responses[index] || responses[responses.length - 1];
      index += 1;
      if (response.content) yield { content: response.content };
      if (response.tool_calls) yield { tool_calls: response.tool_calls };
      yield { usage: response.usage };
    }
  };
}

async function buildContextUsageCounter() {
  const profile = resolveContextProfile('openai', 'gpt-4o');
  const est = new TokenEstimator({ driftMultiplier: profile.driftMultiplier, encoding: profile.encoding });
  await est.preload();
  return {
    counter: new TokenCounter(est, profile),
    builder: new ClassifiedMessageBuilder()
  };
}

describe('ReActRuntime context usage publication timing', () => {
  it('publishes a snapshot after tool results and at turn end (classic run)', async () => {
    const { counter, builder } = await buildContextUsageCounter();
    const measured = vi.fn();

    const tool = new ContextUsageEchoTool();
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(tool);

    const runtime = new ReActRuntime({
      agentDef: {
        id: 'ctx-usage-agent',
        name: 'Ctx Usage Agent',
        description: 'test',
        systemPrompt: 'You are a test agent.',
        providerId: 'test',
        model: 'gpt-4o',
        temperature: 0,
        toolIds: [],
        skillIds: [],
        mcpServerIds: [],
        runtime: { mode: 'react', maxRounds: 3, returnTrace: true }
      } as AgentDefinition,
      provider: createContextUsageProvider([
        {
          content: '',
          tool_calls: [{ id: 'call-1', name: 'context_usage_echo', arguments: { text: 'probe' } }]
        },
        { content: 'final answer' }
      ]),
      tools: [tool],
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) } as any,
      toolRegistry,
      messages: [{ role: 'user', content: 'run test' }],
      silent: true,
      tokenCounter: counter,
      classifiedMessageBuilder: builder,
      onContextUsageMeasured: measured
    });

    await runtime.run();

    // Expect at least 3 snapshots: round 1 pre-call, after round 1 tool result,
    // and the terminal answer measurement.
    expect(measured.mock.calls.length).toBeGreaterThanOrEqual(3);
    const rounds = measured.mock.calls.map((call) => call[1]);
    expect(rounds).toContain(1);
    // The snapshot after the tool result should reflect more tokens than the
    // initial pre-call snapshot (tool output grew the context).
    const snapshots = measured.mock.calls.map((call) => call[0]);
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(snapshots[1].adjustedTotal).toBeGreaterThanOrEqual(snapshots[0].adjustedTotal);
  });

  it('publishes snapshots during streaming runs between rounds', async () => {
    const { counter, builder } = await buildContextUsageCounter();
    const measured = vi.fn();

    const tool = new ContextUsageEchoTool();
    const toolRegistry = ToolRegistry.getInstance();
    toolRegistry.registerTool(tool);

    const runtime = new ReActRuntime({
      agentDef: {
        id: 'ctx-usage-stream-agent',
        name: 'Ctx Usage Stream Agent',
        description: 'test',
        systemPrompt: 'You are a test agent.',
        providerId: 'test',
        model: 'gpt-4o',
        temperature: 0,
        toolIds: [],
        skillIds: [],
        mcpServerIds: [],
        runtime: { mode: 'react', maxRounds: 3, returnTrace: true }
      } as AgentDefinition,
      provider: createContextUsageProvider([
        {
          content: '',
          tool_calls: [{ id: 'call-1', name: 'context_usage_echo', arguments: { text: 'probe' } }]
        },
        { content: 'streamed final answer' }
      ]),
      tools: [tool],
      mcpConfigs: [],
      mcpService: { callTool: async () => ({}) } as any,
      toolRegistry,
      messages: [{ role: 'user', content: 'run test' }],
      silent: true,
      tokenCounter: counter,
      classifiedMessageBuilder: builder,
      onContextUsageMeasured: measured
    });

    const chunks: unknown[] = [];
    for await (const chunk of runtime.stream()) {
      chunks.push(chunk);
    }

    // Streaming path must also publish between rounds and at the terminal answer.
    expect(measured.mock.calls.length).toBeGreaterThanOrEqual(3);
    const lastSnapshot = measured.mock.calls[measured.mock.calls.length - 1][0];
    expect(lastSnapshot.round).toBeGreaterThanOrEqual(1);
  });
});
