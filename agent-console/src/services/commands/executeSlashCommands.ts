import { useTopicStore } from '../../stores';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import { compactSessionContext } from '../../adapters/api/agentRun';
import { showToast, showErrorToast } from '../ui/toast';
import type { ParsedActionTag } from './parseCommands';

type CompactedSnapshot = NonNullable<Awaited<ReturnType<typeof compactSessionContext>>['snapshot']>;

/** Apply a compacted context snapshot to the topic store so the UI updates. */
function applyCompactedSnapshot(topicId: string, snapshot: CompactedSnapshot): void {
  useTopicStore.getState().setTopicContextUsage(topicId, {
    promptTokens: snapshot.adjustedTotal,
    completionTokens: 0,
    totalTokens: snapshot.adjustedTotal,
    byCategory: snapshot.byCategory,
    adjustedTotal: snapshot.adjustedTotal,
    driftMultiplier: snapshot.driftMultiplier,
    maxContextTokens: snapshot.maxContextTokens,
    reserveOutputTokens: snapshot.reserveOutputTokens,
    compactionBuffer: snapshot.compactionBuffer,
    remainingTokens: snapshot.remainingTokens,
    usageRatio: snapshot.usageRatio,
    source: snapshot.source,
    round: snapshot.round,
    compacted: true,
    updatedAt: new Date().toISOString(),
  });
}

/** Fire-and-forget manual context compaction for the active topic. */
function triggerManualCompaction(topicId: string): void {
  if (!topicId) {
    showToast('没有活动话题，无法压缩上下文');
    return;
  }
  showToast('正在压缩上下文…');
  void compactSessionContext(topicId)
    .then((result) => {
      if (!result.compacted) {
        showToast('当前上下文无需压缩');
        return;
      }
      if (result.snapshot) applyCompactedSnapshot(topicId, result.snapshot);
      showToast(
        `已压缩上下文：${result.beforeMessages} → ${result.afterMessages} 条消息`,
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '压缩上下文失败';
      showErrorToast(message);
    });
}

/** Client-side slash command execution before send*/
export function executeSlashCommands(commands: ParsedActionTag[], topicId?: string): boolean {
  let handled = false;

  for (const cmd of commands) {
    if (cmd.type === 'newTopic') {
      useTopicStore.getState().newTopic();
      handled = true;
    } else if (cmd.type === 'compact') {
      if (isAgentConsoleApiMode()) {
        triggerManualCompaction(topicId ?? useTopicStore.getState().activeTopicId);
      } else {
        showToast('压缩上下文仅在 API 模式下可用');
      }
      handled = true;
    }
  }

  return handled;
}
