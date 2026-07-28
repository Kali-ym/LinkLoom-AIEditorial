import { Icon } from '@lobehub/ui';
import type { DropdownItem } from '@lobehub/ui';
import { Check } from 'lucide-react';
import { useMemo } from 'react';

import { useTopicStore } from '../../../stores';
import type { TopicGroupMode, TopicSortBy } from '../../../stores/types';
import { topicFilterStrings } from './topicFilterStrings';

export function useTopicFilterDropdownMenu(): DropdownItem[] {
  const groupMode = useTopicStore((s) => s.groupMode);
  const topicSortBy = useTopicStore((s) => s.topicSortBy);
  const showCompleted = useTopicStore((s) => s.showCompleted);
  const setGroupMode = useTopicStore((s) => s.setGroupMode);
  const setTopicSortBy = useTopicStore((s) => s.setTopicSortBy);
  const setShowCompleted = useTopicStore((s) => s.setShowCompleted);

  return useMemo(() => {
    const groupModes: TopicGroupMode[] = ['byStatus', 'byTime', 'byProject', 'flat'];
    const sortByOptions: TopicSortBy[] = ['createdAt', 'updatedAt'];

    return [
      {
        children: groupModes.map((mode) => ({
          icon: groupMode === mode ? <Icon icon={Check} /> : <span />,
          key: `group-${mode}`,
          label: topicFilterStrings.groupMode[mode],
          onClick: () => setGroupMode(mode),
        })),
        key: 'organize',
        label: topicFilterStrings.organize,
        type: 'group' as const,
      },
      { type: 'divider' as const },
      {
        children: sortByOptions.map((option) => ({
          icon: topicSortBy === option ? <Icon icon={Check} /> : <span />,
          key: `sort-${option}`,
          label: topicFilterStrings.sortBy[option],
          onClick: () => setTopicSortBy(option),
        })),
        key: 'sort',
        label: topicFilterStrings.sort,
        type: 'group' as const,
      },
      { type: 'divider' as const },
      {
        children: [
          {
            icon: showCompleted ? <Icon icon={Check} /> : <span />,
            key: 'showCompleted',
            label: topicFilterStrings.showCompleted,
            onClick: () => setShowCompleted(!showCompleted),
          },
        ],
        key: 'filter',
        label: topicFilterStrings.filter,
        type: 'group' as const,
      },
    ];
  }, [
    groupMode,
    setGroupMode,
    setShowCompleted,
    setTopicSortBy,
    showCompleted,
    topicSortBy,
  ]);
}
