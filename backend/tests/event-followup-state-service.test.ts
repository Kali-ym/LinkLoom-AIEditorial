import { describe, expect, it } from 'vitest';
import { EventFollowupStateService } from '../src/services/editorial/EventFollowupStateService.js';

function createStore(initial: Record<string, unknown> = {}) {
  const values = new Map<string, unknown>(Object.entries(initial));
  return {
    values,
    async get(key: string) {
      return values.get(key);
    },
    async put(key: string, value: unknown) {
      values.set(key, value);
    }
  };
}

describe('EventFollowupStateService', () => {
  it('runs new topic material and persists followup state', async () => {
    const store = createStore();
    const service = new EventFollowupStateService(store);

    const evaluation = await service.evaluateAndCommit({
      date: '2026-06-06',
      topicKey: 'openai-agent-sdk',
      candidates: [
        {
          title: 'OpenAI 发布 Agent SDK 更新',
          url: 'https://example.com/agent-sdk',
          source: 'official'
        }
      ],
      summary: 'Agent SDK 首次进入续报状态。'
    });

    expect(evaluation).toMatchObject({
      topicKey: 'openai-agent-sdk',
      date: '2026-06-06',
      decision: 'run',
      status: 'new',
      reason: 'new_topic'
    });
    expect(evaluation.newItems).toHaveLength(1);
    expect(evaluation.duplicateItems).toEqual([]);

    const state = await service.getState('openai-agent-sdk');
    expect(state).toMatchObject({
      topicKey: 'openai-agent-sdk',
      status: 'active',
      lastSeenDate: '2026-06-06',
      materialCount: 1,
      coveredUrls: ['https://example.com/agent-sdk']
    });
    expect(store.values.get('event_followup:2026-06-06')).toMatchObject({
      date: '2026-06-06',
      items: [expect.objectContaining({ decision: 'run', reason: 'new_topic' })]
    });
  });

  it('skips duplicate material with explicit reason', async () => {
    const store = createStore();
    const service = new EventFollowupStateService(store);
    const input = {
      date: '2026-06-06',
      topicKey: 'openai-agent-sdk',
      candidates: [
        {
          title: 'OpenAI 发布 Agent SDK 更新',
          url: 'https://example.com/agent-sdk',
          source: 'official'
        }
      ]
    };

    await service.evaluateAndCommit(input);
    const duplicate = await service.evaluateAndCommit({ ...input, date: '2026-06-07' });

    expect(duplicate).toMatchObject({
      topicKey: 'openai-agent-sdk',
      date: '2026-06-07',
      decision: 'skip',
      status: 'unchanged',
      reason: 'duplicate_material'
    });
    expect(duplicate.newItems).toEqual([]);
    expect(duplicate.duplicateItems).toHaveLength(1);
    expect(duplicate.evidence).toMatchObject({
      previousMaterialCount: 1,
      currentMaterialCount: 1,
      repeatedUrls: ['https://example.com/agent-sdk']
    });

    const state = await service.getState('openai-agent-sdk');
    expect(state?.lastSeenDate).toBe('2026-06-06');
    expect(state?.materialCount).toBe(1);
    expect(store.values.get('event_followup:2026-06-07')).toMatchObject({
      date: '2026-06-07',
      items: [expect.objectContaining({ decision: 'skip', reason: 'duplicate_material' })]
    });
  });

  it('runs continued topic when new material appears', async () => {
    const store = createStore();
    const service = new EventFollowupStateService(store);

    await service.evaluateAndCommit({
      date: '2026-06-06',
      topicKey: 'openai-agent-sdk',
      candidates: [
        {
          title: 'OpenAI 发布 Agent SDK 更新',
          url: 'https://example.com/agent-sdk',
          source: 'official'
        }
      ]
    });

    const continued = await service.evaluateAndCommit({
      date: '2026-06-07',
      topicKey: 'openai-agent-sdk',
      candidates: [
        {
          title: 'OpenAI 发布 Agent SDK 更新',
          url: 'https://example.com/agent-sdk',
          source: 'official'
        },
        {
          title: 'OpenAI Agent SDK 增加企业权限控制',
          url: 'https://example.com/agent-sdk-enterprise',
          source: 'official'
        }
      ]
    });

    expect(continued).toMatchObject({
      decision: 'run',
      status: 'continued',
      reason: 'new_material'
    });
    expect(continued.newItems).toHaveLength(1);
    expect(continued.duplicateItems).toHaveLength(1);
    expect(continued.evidence).toMatchObject({
      previousMaterialCount: 1,
      currentMaterialCount: 2,
      newUrls: ['https://example.com/agent-sdk-enterprise'],
      repeatedUrls: ['https://example.com/agent-sdk']
    });

    const state = await service.getState('openai-agent-sdk');
    expect(state).toMatchObject({
      lastSeenDate: '2026-06-07',
      materialCount: 2,
      coveredUrls: ['https://example.com/agent-sdk', 'https://example.com/agent-sdk-enterprise']
    });
  });
});