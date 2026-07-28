import { useAgentStore, useTopicStore } from '../../stores';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import { showToast } from '../../services/ui/toast';
import { openRenameModal } from './RenameModal';
import { createMoveTopicsModal } from './MoveTopicsModal';
import { topicModalStrings } from './topicModalStrings';

/** §C.52 — TopicItem / Header rename 触发 */
export function openTopicRenameModal(topicId: string): void {
  const { topics, updateTopicTitle } = useTopicStore.getState();
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return;

  openRenameModal({
    defaultValue: topic.title,
    description: topicModalStrings.renameDescription,
    title: topicModalStrings.renameTitle,
    onSave: async (newTitle) => {
      updateTopicTitle(topicId, newTitle);
    },
  });
}

/** §C.52 — TopicItem move 触发 */
export function openTopicMoveModal(topicId: string, onMoved?: () => void): void {
  if (isAgentConsoleApiMode()) {
    showToast('当前后端暂不支持跨助手移动话题');
    return;
  }
  const activeAgentId = useAgentStore.getState().activeAgentId;
  createMoveTopicsModal({
    onMoved,
    sourceAgentId: activeAgentId,
    topicIds: [topicId],
  });
}

/** §C.52 — 批量移动（§C.53 BulkActionBar 复用） */
export function openTopicsBatchMoveModal(topicIds: string[], onMoved?: () => void): void {
  if (isAgentConsoleApiMode()) {
    showToast('当前后端暂不支持跨助手移动话题');
    return;
  }
  const activeAgentId = useAgentStore.getState().activeAgentId;
  createMoveTopicsModal({
    onMoved,
    sourceAgentId: activeAgentId,
    topicIds,
  });
}
