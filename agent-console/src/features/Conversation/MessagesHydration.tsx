import { memo, useEffect } from 'react';

import { isClientOnlyTopicId } from '../../services/topic/clientTopicStorage';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import { refreshMessagesForTopic } from '../../hooks/data/invalidate';
import { getForkSeedMessages } from '../../services/topic/clientTopicStorage';
import { refreshWorkspaceForTopic } from '../../services/workspace/workspaceSync';
import { isTopicStreaming } from '../../services/streaming/streamingScope';
import {
  isAgentConsoleBootstrapComplete,
  useChatStore,
  useTopicStore,
  whenAgentConsoleBootstrapComplete,
} from '../../stores';

/**
 * api 模式：随 activeTopicId 变化，把该 topic 的历史 messages 从 IChatPort
 * 加载进 chatStore（+ Query 缓存）。mock 模式由 bootstrap 同步 seed，无需此同步。
 * 空 temp 话题仅客户端 seed，跳过 API（skipApiHydration）。
 * fork 话题有 seed 时仍走 refreshMessagesForTopic，由 invalidate 合并 seed + API。
 * bootstrap 已写入的 topic 跳过重复 messages fetch。
 */
export const MessagesHydration = memo(function MessagesHydration() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const isClientOnlyTopic = activeTopicId ? isClientOnlyTopicId(activeTopicId) : false;
  const hasForkSeed = activeTopicId ? getForkSeedMessages(activeTopicId).length > 0 : false;
  const skipApiHydration = isClientOnlyTopic && !hasForkSeed;

  useEffect(() => {
    if (!isAgentConsoleApiMode() || !activeTopicId || skipApiHydration) return;
    if (isTopicStreaming(activeTopicId)) return;
    if (useChatStore.getState().getStreamingMessage(activeTopicId)) return;

    let cancelled = false;

    const run = async () => {
      if (!isAgentConsoleBootstrapComplete()) {
        await whenAgentConsoleBootstrapComplete();
      }
      if (cancelled) return;

      const alreadyHydrated = Object.prototype.hasOwnProperty.call(
        useChatStore.getState().messagesByTopicId,
        activeTopicId,
      );
      if (!alreadyHydrated || hasForkSeed) {
        await refreshMessagesForTopic(activeTopicId).catch((error) => {
          console.error('[agentConsole] load messages for topic failed', error);
        });
      }

      if (cancelled) return;
      await refreshWorkspaceForTopic(activeTopicId).catch((error) => {
        console.error('[agentConsole] load workspace for topic failed', error);
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeTopicId, hasForkSeed, skipApiHydration]);

  return null;
});
