import { describe, expect, it } from 'vitest';
import {
  classifyObservation,
  createObservationPolicyTracker
} from '../src/services/agents/engine/ObservationPolicy.js';
import type { AgentToolObservation } from '../src/types/agent.js';

function observation(
  partial: Partial<AgentToolObservation> & Pick<AgentToolObservation, 'content'>
): AgentToolObservation {
  return {
    toolName: 'test_tool',
    success: true,
    durationMs: 1,
    ...partial
  };
}

describe('ObservationPolicy classification', () => {
  it('classifies limited status as no_progress', () => {
    const result = classifyObservation(
      observation({
        content: JSON.stringify({ status: 'limited', summary: 'tool budget exhausted' }),
        data: { status: 'limited', summary: 'tool budget exhausted' }
      })
    );

    expect(result).toMatchObject({
      kind: 'no_progress',
      reason: 'status:limited'
    });
  });

  it('classifies skipped status as no_progress', () => {
    const result = classifyObservation(
      observation({
        content: JSON.stringify({ status: 'skipped' }),
        data: { status: 'skipped' }
      })
    );

    expect(result).toMatchObject({
      kind: 'no_progress',
      reason: 'status:skipped'
    });
  });

  it('classifies found:false as no_progress', () => {
    const result = classifyObservation(
      observation({
        content: JSON.stringify({ found: false }),
        data: { found: false }
      })
    );

    expect(result).toMatchObject({
      kind: 'no_progress',
      reason: 'found:false'
    });
  });

  it('classifies empty candidates as no_progress', () => {
    const result = classifyObservation(
      observation({
        content: JSON.stringify({ candidates: [] }),
        data: { candidates: [] }
      })
    );

    expect(result).toMatchObject({
      kind: 'no_progress',
      reason: 'candidates:empty'
    });
  });

  it('treats successful non-empty results as progress', () => {
    const result = classifyObservation(
      observation({
        content: JSON.stringify({ found: true, candidates: [{ id: 'agent_1' }] }),
        data: { found: true, candidates: [{ id: 'agent_1' }] }
      })
    );

    expect(result.kind).toBe('progress');
  });

  it('treats cached tool results as progress when ignoreCachedResults is enabled', () => {
    const result = classifyObservation(
      observation({
        content: JSON.stringify({ status: 'ok', cached: true, data: { id: 'agent_1', exists: true } }),
        data: { status: 'ok', cached: true, data: { id: 'agent_1', exists: true } }
      }),
      { ignoreCachedResults: true }
    );

    expect(result.kind).toBe('progress');
  });

  it('treats missing inspect results as progress when found is not used', () => {
    const result = classifyObservation(
      observation({
        content: JSON.stringify({
          status: 'ok',
          summary: '库中尚无 agent:draft_agent，可按计划新建该资源。',
          data: { type: 'agent', id: 'draft_agent', exists: false, resourceState: 'missing' }
        }),
        data: {
          status: 'ok',
          data: { type: 'agent', id: 'draft_agent', exists: false, resourceState: 'missing' }
        }
      }),
      { ignoreCachedResults: true, noProgressBooleanFields: ['success', 'matched'] }
    );

    expect(result.kind).toBe('progress');
  });

  it('treats weak-match summaries as progress when ignoreTextNoProgress is enabled', () => {
    const relaxedPolicy = {
      ignoreCachedResults: true,
      ignoreTextNoProgress: true,
      noProgressBooleanFields: ['success'],
      noProgressStatuses: ['limited', 'invalid']
    };
    const result = classifyObservation(
      observation({
        content: JSON.stringify({
          status: 'ok',
          summary: '关键词弱匹配，返回 5 个 Catalog 目录概览候选资源。',
          candidates: [{ id: 'agent_news', score: 0 }]
        }),
        data: {
          status: 'ok',
          summary: '关键词弱匹配，返回 5 个 Catalog 目录概览候选资源。',
          candidates: [{ id: 'agent_news', score: 0 }]
        }
      }),
      relaxedPolicy
    );

    expect(result.kind).toBe('progress');
  });
});

describe('ObservationPolicy tracker', () => {
  const policy = { enabled: true, maxRepeatedNoProgress: 1, maxGuardedRepeats: 1 };

  it('returns undefined when policy is disabled or missing', () => {
    expect(createObservationPolicyTracker({ enabled: false })).toBeUndefined();
    expect(createObservationPolicyTracker(undefined)).toBeUndefined();
  });

  it('blocks repeated identical no-progress tool calls with the same arguments', () => {
    const tracker = createObservationPolicyTracker(policy)!;
    const args = { query: 'news digest' };

    expect(tracker.beforeToolCall({ toolName: 'query_data', arguments: args })).toMatchObject({
      action: 'allow'
    });

    tracker.recordObservation({
      toolName: 'query_data',
      arguments: args,
      observation: observation({
        content: JSON.stringify({ found: false, candidates: [] }),
        data: { found: false, candidates: [] }
      })
    });

    const blocked = tracker.beforeToolCall({ toolName: 'query_data', arguments: args });
    expect(blocked).toMatchObject({
      action: 'block',
      reason: 'repeated_tool_observation',
      data: expect.objectContaining({
        reason: 'repeated_no_progress_observation',
        toolName: 'query_data'
      })
    });
  });

  it('stops the run when the model keeps repeating after a guard observation', () => {
    const tracker = createObservationPolicyTracker(policy)!;
    const args = { query: 'news digest' };
    const noProgress = observation({
      content: JSON.stringify({ status: 'limited' }),
      data: { status: 'limited' }
    });

    tracker.recordObservation({
      toolName: 'query_data',
      arguments: args,
      observation: noProgress
    });
    tracker.beforeToolCall({ toolName: 'query_data', arguments: args });

    const stopped = tracker.beforeToolCall({ toolName: 'query_data', arguments: args });
    expect(stopped).toMatchObject({
      action: 'stop',
      reason: 'repeated_tool_observation'
    });
  });

  it('clears repeated-call state after a progress observation', () => {
    const tracker = createObservationPolicyTracker(policy)!;
    const args = { query: 'news digest' };

    tracker.recordObservation({
      toolName: 'query_data',
      arguments: args,
      observation: observation({
        content: JSON.stringify({ found: false, candidates: [] }),
        data: { found: false, candidates: [] }
      })
    });

    tracker.recordObservation({
      toolName: 'query_data',
      arguments: args,
      observation: observation({
        content: JSON.stringify({ found: true, candidates: [{ id: 'agent_1' }] }),
        data: { found: true, candidates: [{ id: 'agent_1' }] }
      })
    });

    expect(tracker.beforeToolCall({ toolName: 'query_data', arguments: args })).toMatchObject({
      action: 'allow'
    });
  });

  it('treats different argument keys as distinct call keys', () => {
    const tracker = createObservationPolicyTracker({
      enabled: true,
      maxRepeatedNoProgress: 1,
      maxGuardedRepeats: 1
    })!;

    tracker.recordObservation({
      toolName: 'query_data',
      arguments: { query: 'daily news' },
      observation: observation({
        content: JSON.stringify({ found: false, candidates: [] }),
        data: { found: false, candidates: [] }
      })
    });

    expect(
      tracker.beforeToolCall({
        toolName: 'query_data',
        arguments: { goal: 'daily news' }
      })
    ).toMatchObject({ action: 'allow' });
  });
});
