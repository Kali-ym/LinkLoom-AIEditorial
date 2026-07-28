import { Tag } from '@lobehub/ui';
import { MessageSquarePlusIcon } from 'lucide-react';
import { memo, useCallback, type MouseEvent } from 'react';

import { useTopicStore } from '../../../../stores';

export interface ReferTopicViewProps {
  fallbackTitle?: string;
  topicId: string;
}

export const ReferTopicView = memo<ReferTopicViewProps>(({ topicId, fallbackTitle }) => {
  const title =
    useTopicStore((s) => s.topics.find((t) => t.id === topicId)?.title) || fallbackTitle;
  const selectTopic = useTopicStore((s) => s.selectTopic);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (topicId) selectTopic(topicId);
    },
    [selectTopic, topicId],
  );

  return (
    <span
      style={{
        cursor: topicId ? 'pointer' : 'default',
        display: 'inline-flex',
        marginInlineEnd: 4,
        userSelect: 'none',
      }}
      onClick={handleClick}
    >
      <Tag color="green" icon={<MessageSquarePlusIcon size={12} />} variant="filled">
        {title || '话题'}
      </Tag>
    </span>
  );
});

ReferTopicView.displayName = 'ReferTopicView';
