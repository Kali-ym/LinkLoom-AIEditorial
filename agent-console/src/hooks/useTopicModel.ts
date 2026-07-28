import { useCallback, useLayoutEffect, useMemo } from 'react';

import type { TopicModelSelection } from '../domain/agentConsoleScope';
import {
  ensureTopicModelLoaded,
  persistTopicModelSelection,
  resolveTopicEffectiveModel,
  resolveTopicModelOverride,
} from '../services/topic/topicModelBinding';
import { useAgentStore, useTopicStore } from '../stores';

/** 当前话题的有效模型：优先 topic 级 override，否则回落到 agent 默认。 */
export function useTopicModel(topicId: string | null | undefined): {
  model: string;
  provider: string;
  setTopicModel: (selection: TopicModelSelection) => void;
} {
  const agentDefault = useAgentStore((s) => s.getActivePlusState());
  const topicModel = useTopicStore((s) => (topicId ? s.modelByTopicId[topicId] : undefined));

  useLayoutEffect(() => {
    if (topicId) ensureTopicModelLoaded(topicId);
  }, [topicId]);

  const effective = useMemo(
    () =>
      topicModel ??
      (topicId ? resolveTopicModelOverride(topicId) : null) ?? {
        model: agentDefault.model,
        provider: agentDefault.provider,
      },
    [agentDefault.model, agentDefault.provider, topicId, topicModel],
  );

  const setTopicModel = useCallback(
    (selection: TopicModelSelection) => {
      if (!topicId) return;
      persistTopicModelSelection(topicId, selection);
    },
    [topicId],
  );

  return {
    model: effective.model,
    provider: effective.provider,
    setTopicModel,
  };
}

/** 非 React 环境读取 topic 有效模型（如流式发送）。 */
export function getEffectiveTopicModel(topicId: string): TopicModelSelection {
  return resolveTopicEffectiveModel(topicId);
}
