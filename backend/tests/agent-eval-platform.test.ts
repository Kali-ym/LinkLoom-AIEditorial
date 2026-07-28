import { describe, expect, it, vi } from 'vitest';
import { AgentRegressionService } from '../src/services/agents/AgentRegressionService.js';
import type { AgentSession } from '../src/services/agents/engine/AgentSession.js';
import type { AgentRunSpec } from '../src/services/agents/engine/AgentRunSpec.js';

function createStore(initial: Record<string, unknown> = {}) {
  const values = new Map<string, unknown>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => values.get(key)),
    put: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    values
  };
}

function createContext(runAgent: ReturnType<typeof vi.fn>, extra: Record<string, unknown> = {}) {
  return {
    agentService: {
      runAgent,
      ...extra
    }
  };
}

const sampleDefaults = {
  id: 'sample_1',
  name: 'Sample 1',
  agentId: 'agent_1',
  prompt: 'Say hello'
};

describe('Agent Eval Platform regression compatibility', () => {
  it('keeps legacy regression sample and run behavior usable', async () => {
    const store = createStore();
    const runAgent = vi.fn(async () => ({
      content: 'Hello LinkLoom',
      trace: { runId: 'run_legacy', mode: 'react', startedAt: '2026-01-01T00:00:00.000Z', rounds: [] }
    }));
    const service = new AgentRegressionService(store as never, createContext(runAgent) as never);

    const sample = await service.saveSample({
      ...sampleDefaults,
      expectedContains: ['linkloom']
    });
    const summary = await service.runSamples([sample.id]);

    expect(sample).toMatchObject({
      id: 'sample_1',
      name: 'Sample 1',
      agentId: 'agent_1',
      prompt: 'Say hello',
      expectedContains: ['linkloom']
    });
    expect(summary).toMatchObject({ total: 1, passed: 1, failed: 0 });
    expect(summary.records[0]).toMatchObject({
      runId: 'run_legacy',
      sampleId: 'sample_1',
      passed: true,
      outputPreview: 'Hello LinkLoom',
      mismatches: [],
      score: 1
    });
    expect(runAgent).toHaveBeenCalledWith(
      'agent_1',
      'Say hello',
      undefined,
      expect.objectContaining({ silent: true, noTools: true, runSource: 'eval' })
    );
  });

  it('stores optional eval dataset, baseline, policy and scorer results', async () => {
    const store = createStore();
    let createdSpec: AgentRunSpec | undefined;
    const runAgent = vi.fn(async (_agentId, _input, _date, options) => {
      createdSpec = { runId: 'platform_run_1', sessionId: 'session_1' } as AgentRunSpec;
      await options.onRunCreated(createdSpec);
      return {
        content: JSON.stringify({ status: 'ok', count: 2 }),
        toolCalls: [{ id: 'call_1', name: 'search_docs', arguments: { query: 'agent' } }]
      };
    });
    const service = new AgentRegressionService(store as never, createContext(runAgent) as never);

    const sample = await service.saveSample({
      ...sampleDefaults,
      datasetId: 'dataset_l2',
      baseline: { id: 'baseline_1', model: 'model_a' },
      execution: { tools: 'enabled', skills: 'disabled', timeoutMs: 5000, maxModelCalls: 2 },
      metadata: { owner: 'platform' },
      scorers: [
        { id: 'json_status', kind: 'json_schema', schema: { type: 'object', required: ['status'] } },
        { id: 'tool_search', kind: 'tool_call', toolName: 'search_docs' },
        { id: 'no_error', kind: 'not_contains', value: 'error' }
      ]
    });
    const summary = await service.runSamples([sample.id]);
    const options = runAgent.mock.calls[0][3];

    expect(summary).toMatchObject({ total: 1, passed: 1, failed: 0, datasetIds: ['dataset_l2'] });
    expect(summary.score).toBe(1);
    expect(summary.records[0]).toMatchObject({
      runId: 'platform_run_1',
      datasetId: 'dataset_l2',
      baseline: { id: 'baseline_1', model: 'model_a' },
      score: 1,
      metadata: { sessionId: 'session_1' }
    });
    expect(summary.records[0].scores?.map((score) => score.scorerId)).toEqual([
      'json_status',
      'tool_search',
      'no_error'
    ]);
    expect(options).toMatchObject({
      noTools: false,
      noSkills: true,
      budgetPolicy: { timeoutMs: 5000, maxModelCalls: 2 },
      metadata: {
        eval: true,
        evalDatasetId: 'dataset_l2',
        evalSampleId: 'sample_1',
        evalSampleName: 'Sample 1',
        evalBaseline: { id: 'baseline_1', model: 'model_a' },
        owner: 'platform'
      }
    });
    expect(createdSpec).toMatchObject({ runId: 'platform_run_1', sessionId: 'session_1' });
  });

  it('can replay from a stored run session checkpoint without creating a new public API', async () => {
    const store = createStore();
    const session: AgentSession = {
      sessionId: 'session_source',
      runId: 'run_source',
      source: 'agent',
      status: 'succeeded',
      messages: [{ role: 'user', content: 'Checkpoint prompt' }],
      events: [],
      checkpoints: [
        {
          checkpointId: 'checkpoint_1',
          runId: 'run_source',
          sessionId: 'session_source',
          status: 'succeeded',
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'Replay prompt' }
          ],
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      artifacts: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      metadata: { agentId: 'agent_1' }
    };
    const getRunSession = vi.fn(async () => session);
    const runAgent = vi.fn(async () => ({ content: 'Replay output' }));
    const service = new AgentRegressionService(
      store as never,
      createContext(runAgent, { getRunSession }) as never
    );

    const sample = await service.saveSample({
      ...sampleDefaults,
      prompt: '',
      replay: { sourceRunId: 'run_source', checkpointId: 'checkpoint_1' },
      expectedContains: ['Replay output']
    });
    const summary = await service.runSamples([sample.id]);

    expect(getRunSession).toHaveBeenCalledWith('run_source');
    expect(runAgent).toHaveBeenCalledWith(
      'agent_1',
      'Replay prompt',
      undefined,
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'Replay prompt' }
        ]
      })
    );
    expect(summary.records[0].replay).toEqual({
      sourceRunId: 'run_source',
      checkpointId: 'checkpoint_1',
      mode: 'checkpoint',
      messageCount: 2
    });
  });
});