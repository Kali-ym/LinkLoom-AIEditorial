// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const topicState = {
  modelByTopicId: {} as Record<string, { model: string; provider: string }>,
  setTopicModelProvider: vi.fn((topicId: string, selection: { model: string; provider: string }) => {
    topicState.modelByTopicId[topicId] = selection;
  }),
};

const agentState = {
  getActivePlusState: () => ({
    model: 'gpt-5.5',
    provider: 'ahg-openai',
  }),
};

vi.mock('../../stores/topicStore', () => ({
  useTopicStore: {
    getState: () => topicState,
    setState: (
      updater:
        | Partial<typeof topicState>
        | ((s: typeof topicState) => Partial<typeof topicState>),
    ) => {
      const patch = typeof updater === 'function' ? updater(topicState) : updater;
      if (patch.modelByTopicId) {
        topicState.modelByTopicId = { ...topicState.modelByTopicId, ...patch.modelByTopicId };
      }
      Object.assign(topicState, { ...patch, modelByTopicId: topicState.modelByTopicId });
    },
  },
}));

vi.mock('../../stores/agentStore', () => ({
  useAgentStore: {
    getState: () => agentState,
  },
}));

import {
  persistTopicModelForSend,
  persistTopicModelSelection,
  ensureTopicModelLoaded,
  resolveTopicModelOverride,
} from './topicModelBinding';
import { writeStoredTopicModel } from './topicModelStorage';

describe('topicModelBinding', () => {
  beforeEach(() => {
    localStorage.clear();
    topicState.modelByTopicId = {};
    topicState.setTopicModelProvider.mockClear();
  });

  it('resolveTopicModelOverride reads localStorage when memory is empty', () => {
    writeStoredTopicModel('tpc_1', { model: 'deepseek-v4', provider: 'ai-eh811' });
    expect(resolveTopicModelOverride('tpc_1')).toEqual({
      model: 'deepseek-v4',
      provider: 'ai-eh811',
    });
  });

  it('ensureTopicModelLoaded copies localStorage into modelByTopicId', () => {
    writeStoredTopicModel('tpc_2', { model: 'agnes-2.0-flash', provider: 'ai-eh811' });
    ensureTopicModelLoaded('tpc_2');
    expect(topicState.modelByTopicId.tpc_2).toEqual({
      model: 'agnes-2.0-flash',
      provider: 'ai-eh811',
    });
  });

  it('persistTopicModelSelection writes immediately on UI switch', () => {
    persistTopicModelSelection('tpc_switch', {
      model: 'deepseek-v4-flash',
      provider: 'ai-eh811',
    });
    expect(topicState.setTopicModelProvider).toHaveBeenCalledWith('tpc_switch', {
      model: 'deepseek-v4-flash',
      provider: 'ai-eh811',
    });
    expect(topicState.modelByTopicId.tpc_switch).toEqual({
      model: 'deepseek-v4-flash',
      provider: 'ai-eh811',
    });
  });

  it('persistTopicModelForSend pins agent default on first send', () => {
    persistTopicModelForSend('tpc_new');
    expect(topicState.setTopicModelProvider).toHaveBeenCalledWith('tpc_new', {
      model: 'gpt-5.5',
      provider: 'ahg-openai',
    });
  });

  it('persistTopicModelForSend re-persists after mid-conversation model switch', () => {
    topicState.modelByTopicId.tpc_mid = {
      model: 'deepseek-v4-flash',
      provider: 'ai-eh811',
    };
    persistTopicModelForSend('tpc_mid');
    expect(topicState.setTopicModelProvider).toHaveBeenCalledWith('tpc_mid', {
      model: 'deepseek-v4-flash',
      provider: 'ai-eh811',
    });
  });
});
