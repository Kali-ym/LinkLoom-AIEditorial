import { describe, expect, it, vi } from 'vitest';
import { AgentService } from '../src/services/agents/AgentService.js';
import { createAgentSpecSnapshot } from '../src/services/agents/engine/AgentSpec.js';
import { InMemoryAgentRunRegistry } from '../src/services/agents/engine/AgentRunRegistry.js';
import type { AIProvider } from '../src/services/AIProvider.js';
import type { AgentDefinition } from '../src/types/agent.js';

function createAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'spec-agent',
    name: 'Spec Agent',
    description: 'agent spec test agent',
    systemPrompt: 'You are a spec test agent.',
    providerId: 'test-provider-id',
    model: 'spec-model',
    temperature: 0.2,
    toolIds: ['tool_b', 'tool_a'],
    skillIds: ['skill_a'],
    mcpServerIds: ['mcp_a'],
    runtime: {
      mode: 'react',
      maxRounds: 2,
      returnTrace: true
    },
    metadata: { tier: 'test' },
    ...overrides
  };
}

function createStore(agent: AgentDefinition) {
  const values = new Map<string, unknown>();
  return {
    getAgent: vi.fn().mockResolvedValue(agent),
    get: vi.fn(async (key: string) => (key === 'system_settings' ? { AI_PROVIDERS: [], CLOSED_PLUGINS: [] } : values.get(key))),
    put: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    getMCPConfig: vi.fn().mockResolvedValue(undefined)
  };
}

function createProvider(): AIProvider {
  return {
    name: 'spec-provider',
    generateContent: vi.fn(async () => ({ content: 'spec answer' })),
    streamContent: vi.fn(async function* () {
      yield { content: 'spec stream answer' };
    })
  };
}

function createService(agent: AgentDefinition, runRegistry = new InMemoryAgentRunRegistry()) {
  const service = new AgentService(
    createStore(agent) as never,
    createProvider(),
    { buildSkillsPrompt: vi.fn().mockResolvedValue('') } as never,
    { getTools: vi.fn().mockResolvedValue([]), callTool: vi.fn() } as never,
    undefined,
    runRegistry
  );
  return { service, runRegistry };
}

async function collect(iterable: AsyncIterable<unknown>) {
  const chunks: unknown[] = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

describe('AgentSpec versioning', () => {
  it('creates stable revisions from normalized agent execution fields', () => {
    const first = createAgentSpecSnapshot(createAgent({ toolIds: ['tool_b', 'tool_a'] }), '2026-01-01T00:00:00.000Z');
    const second = createAgentSpecSnapshot(createAgent({ toolIds: ['tool_a', 'tool_b'] }), '2026-01-02T00:00:00.000Z');
    const changedPrompt = createAgentSpecSnapshot(createAgent({ systemPrompt: 'Changed prompt' }), '2026-01-01T00:00:00.000Z');
    const changedModel = createAgentSpecSnapshot(createAgent({ model: 'next-model' }), '2026-01-01T00:00:00.000Z');

    expect(first.schemaVersion).toBe('agent-spec-v1');
    expect(first.tools.toolIds).toEqual(['tool_a', 'tool_b']);
    expect(first.revision).toBe(second.revision);
    expect(first.specId).toBe(`spec-agent@${first.revision}`);
    expect(first.revision).not.toBe(changedPrompt.revision);
    expect(first.revision).not.toBe(changedModel.revision);
  });

  it('binds non-stream runs to an immutable AgentSpec snapshot in run and session metadata', async () => {
    const { service, runRegistry } = createService(createAgent());
    let createdSpecRevision = '';
    let runId = '';

    await service.runAgent('spec-agent', 'hello', undefined, {
      silent: true,
      onRunCreated: (spec) => {
        runId = spec.runId;
        createdSpecRevision = spec.agentSpec?.revision ?? '';
        expect(spec.agentSpec).toMatchObject({
          schemaVersion: 'agent-spec-v1',
          agentId: 'spec-agent',
          name: 'Spec Agent',
          model: { providerId: 'test-provider-id', model: 'spec-model', temperature: 0.2 },
          tools: { toolIds: ['tool_a', 'tool_b'], skillIds: ['skill_a'], mcpServerIds: ['mcp_a'] }
        });
      }
    });

    const run = await runRegistry.get(runId);
    const session = await service.getRunSession(runId);

    expect(createdSpecRevision).toMatch(/^[a-f0-9]{16}$/);
    expect(run).toMatchObject({
      agentId: 'spec-agent',
      agentSpecId: `spec-agent@${createdSpecRevision}`,
      agentSpecRevision: createdSpecRevision
    });
    expect(run?.agentSpec?.revision).toBe(createdSpecRevision);
    expect(run?.metadata).toMatchObject({
      agentSpecId: `spec-agent@${createdSpecRevision}`,
      agentSpecRevision: createdSpecRevision
    });
    expect((session?.metadata?.agentSpec as any)?.revision).toBe(createdSpecRevision);
    expect(session?.metadata).toMatchObject({
      agentSpecId: `spec-agent@${createdSpecRevision}`,
      agentSpecRevision: createdSpecRevision
    });
  });

  it('binds stream runs to the same AgentSpec snapshot contract without changing legacy chunks', async () => {
    const { service, runRegistry } = createService(createAgent());
    let runId = '';
    let specRevision = '';

    const chunks = await collect(
      service.streamAgent('spec-agent', 'hello', undefined, {
        silent: true,
        onRunCreated: (spec) => {
          runId = spec.runId;
          specRevision = spec.agentSpec?.revision ?? '';
        }
      })
    );
    const run = await runRegistry.get(runId);

    expect(chunks.map((chunk) => (chunk as { type?: string }).type)).toEqual([
      'round_start',
      'content',
      'final_content',
      'final_trace'
    ]);
    for (const chunk of chunks) {
      expect(chunk).not.toHaveProperty('agentSpec');
      expect(chunk).not.toHaveProperty('agentSpecRevision');
    }
    expect(chunks[1]).toMatchObject({ type: 'content', content: 'spec stream answer' });
    expect(run?.agentSpecRevision).toBe(specRevision);
    expect(run?.agentSpec?.specId).toBe(`spec-agent@${specRevision}`);
  });
});