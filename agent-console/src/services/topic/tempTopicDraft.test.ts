// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import type { Topic } from '../../domain/types';
import { removeClientTopic, saveClientTopic } from './clientTopicStorage';
import {
  dedupeTopicsById,
  findEmptyTempClientTopicForAgent,
} from './tempTopicDraft';

const AGENT = 'agent_admin';
const TOPIC_ID = 'tpc_stale0001';

describe('findEmptyTempClientTopicForAgent', () => {
  beforeEach(() => {
    removeClientTopic(TOPIC_ID);
  });

  it('skips empty drafts whose id already exists in the sidebar', () => {
    saveClientTopic({
      id: TOPIC_ID,
      title: '新话题',
      agentId: AGENT,
      messages: [],
      createdAt: '2026-07-29T00:00:00.000Z',
    });

    expect(findEmptyTempClientTopicForAgent(AGENT)?.id).toBe(TOPIC_ID);
    expect(
      findEmptyTempClientTopicForAgent(AGENT, { excludeTopicIds: [TOPIC_ID] }),
    ).toBeUndefined();
  });
});

describe('dedupeTopicsById', () => {
  it('collapses duplicate ids and prefers the non-temp entry', () => {
    const topics: Topic[] = [
      {
        id: TOPIC_ID,
        title: '新话题',
        status: 'temp',
        tag: '临时',
        agentId: AGENT,
      },
      {
        id: TOPIC_ID,
        title: '你好',
        status: 'completed',
        agentId: AGENT,
      },
      {
        id: 'tpc_other0001',
        title: '其他',
        status: 'completed',
        agentId: AGENT,
      },
    ];

    const deduped = dedupeTopicsById(topics);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]).toMatchObject({ id: TOPIC_ID, status: 'completed', title: '你好' });
    expect(deduped[1]?.id).toBe('tpc_other0001');
  });
});
