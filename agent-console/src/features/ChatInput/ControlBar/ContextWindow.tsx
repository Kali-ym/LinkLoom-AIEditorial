import { memo, useMemo } from 'react';

import { buildLocalContextSnapshot } from '../../../hooks/buildLocalContextSnapshot';
import {
  computeContextTokenBreakdown,
  resolveMaxContextWindowTokens,
} from '../../../hooks/useContextTokenBreakdown';
import { useFindEnabledModel } from '../../../hooks/data/useCatalog';
import { useContextUsageSnapshot } from '../../../hooks/useContextUsageSnapshot';
import {
  selectMessagesForTopic,
  selectStreamingMessageForTopic,
} from '../../../selectors/storeSelectors';
import {
  useAgentStore,
  useChatStore,
  useInputStore,
  useTopicStore,
} from '../../../stores';
import { ContextUsagePopover } from './ContextUsagePopover';

const hasBackendSnapshot = (apiUsage: unknown): apiUsage is {
  byCategory: Record<string, number>;
  maxContextTokens: number;
} => {
  if (!apiUsage || typeof apiUsage !== 'object') return false;
  const u = apiUsage as { byCategory?: unknown; maxContextTokens?: unknown };
  return !!u.byCategory && typeof u.maxContextTokens === 'number';
};

/** §C.30 */
export const ContextWindow = memo(function ContextWindow() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const messages = useChatStore(selectMessagesForTopic(activeTopicId));
  const streamingMessage = useChatStore(selectStreamingMessageForTopic(activeTopicId));
  const draft = useInputStore((s) => s.markdownContent || s.draft);
  const plusState = useAgentStore((s) => s.getActivePlusState());
  const modelMeta = useFindEnabledModel(plusState.model, plusState.provider);
  const apiUsage = useTopicStore((s) => s.contextUsageByTopicId[activeTopicId]);

  const maxTokens = resolveMaxContextWindowTokens(plusState, modelMeta?.contextWindowTokens);

  // During streaming, the in-flight assistant message lives in
  // `streamingByTopicId`, not `messagesByTopicId` (it only lands in the latter
  // after `finalizeStreamingMessage`). Without including it here, the local
  // fallback snapshot never grows while the agent is answering, so the context
  // meter appears frozen mid-turn.
  const messagesWithStreaming = useMemo(() => {
    if (!streamingMessage?.content?.trim()) return messages;
    return [
      ...messages,
      {
        id: streamingMessage.id,
        role: 'assistant' as const,
        content: streamingMessage.content,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [messages, streamingMessage]);

  const breakdown = useMemo(
    () => computeContextTokenBreakdown(messagesWithStreaming, draft, plusState),
    [draft, messagesWithStreaming, plusState],
  );

  const backendReady = hasBackendSnapshot(apiUsage);

  const backendSnapshot = useContextUsageSnapshot({
    apiUsage: backendReady ? apiUsage : undefined,
    draft: backendReady ? draft : '',
    driftMultiplier: backendReady ? apiUsage.driftMultiplier : undefined,
  });

  const localSnapshot = useMemo(
    () => buildLocalContextSnapshot(breakdown, maxTokens),
    [breakdown, maxTokens],
  );

  const snapshot = backendSnapshot ?? localSnapshot;

  if (!maxTokens) return null;

  return <ContextUsagePopover snapshot={snapshot} />;
});
