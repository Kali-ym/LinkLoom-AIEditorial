import { memo, useCallback } from 'react';

import { InlineRename } from '../../../../../components/InlineRename';
import { useTopicStore } from '../../../../../stores';

interface TopicEditingProps {
  id: string;
  title: string;
  toggleEditing: (visible?: boolean) => void;
}

export const TopicEditing = memo(function TopicEditing({
  id,
  title,
  toggleEditing,
}: TopicEditingProps) {
  const editing = useTopicStore((s) => s.topicRenamingId === id);
  const updateTopicTitle = useTopicStore((s) => s.updateTopicTitle);
  const topicLoadingIds = useTopicStore((s) => s.topicLoadingIds);

  const handleSave = useCallback(
    async (newTitle: string) => {
      useTopicStore.setState({
        topicLoadingIds: [...topicLoadingIds, id],
      });
      try {
        updateTopicTitle(id, newTitle);
      } finally {
        useTopicStore.setState({
          topicLoadingIds: useTopicStore
            .getState()
            .topicLoadingIds.filter((loadingId) => loadingId !== id),
        });
      }
    },
    [id, topicLoadingIds, updateTopicTitle],
  );

  return (
    <InlineRename
      open={editing}
      title={title}
      onOpenChange={(open) => toggleEditing(open)}
      onSave={handleSave}
    />
  );
});
