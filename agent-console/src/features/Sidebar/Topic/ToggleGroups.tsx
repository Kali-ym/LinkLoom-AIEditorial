import { ActionIcon } from '@lobehub/ui';
import { Maximize2, Minimize2 } from 'lucide-react';
import { memo, useMemo } from 'react';

import { useTopicStore } from '../../../stores';
import { useFilteredTopics } from './hooks/useFilteredTopics';
import { groupTopicsByMode } from './topicListUtils';

export const TopicToggleGroups = memo(function TopicToggleGroups() {
  const groupMode = useTopicStore((s) => s.groupMode);
  const expandTopicGroupKeys = useTopicStore((s) => s.expandTopicGroupKeys);
  const setExpandTopicGroupKeys = useTopicStore((s) => s.setExpandTopicGroupKeys);
  const topics = useFilteredTopics();

  const groupIds = useMemo(
    () => groupTopicsByMode(topics, groupMode).map((g) => g.id),
    [groupMode, topics],
  );

  const expandedKeys = expandTopicGroupKeys ?? groupIds;
  const isAllCollapsed = expandedKeys.length === 0;

  if (groupMode === 'flat' || groupIds.length < 2) return null;

  return (
    <ActionIcon
      icon={isAllCollapsed ? Maximize2 : Minimize2}
      size="small"
      title={isAllCollapsed ? '展开全部分组' : '收起全部分组'}
      onClick={() => setExpandTopicGroupKeys(isAllCollapsed ? groupIds : [])}
    />
  );
});
