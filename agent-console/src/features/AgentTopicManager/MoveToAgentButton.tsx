import { ActionIcon } from '@lobehub/ui';
import { FolderInput } from 'lucide-react';
import { memo } from 'react';

import { openTopicsBatchMoveModal } from '../TopicModals/helpers';
import { agentTopicManagerStrings } from './agentTopicManagerStrings';
import { useTopicsViewStore } from './store';

/** §C.53*/
export const MoveToAgentButton = memo(function MoveToAgentButton() {
  const selectedIds = useTopicsViewStore((s) => s.selectedIds);
  const exitSelectMode = useTopicsViewStore((s) => s.exitSelectMode);

  return (
    <ActionIcon
      icon={FolderInput}
      size="small"
      title={agentTopicManagerStrings.bulkMove}
      onClick={() => {
        if (selectedIds.length === 0) return;
        openTopicsBatchMoveModal(selectedIds, exitSelectMode);
      }}
    />
  );
});
