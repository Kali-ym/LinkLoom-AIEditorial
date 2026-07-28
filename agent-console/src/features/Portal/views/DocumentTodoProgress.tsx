import { Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { selectTodosForTopic } from '../../../selectors/workspaceSelectors';
import { useTopicStore, useWorkspaceStore } from '../../../stores';
import { portalViewStyles } from '../portalViewStyles';

/** §C.21 Document — compact todo progress from workspace todos */
export const DocumentTodoProgress = memo(function DocumentTodoProgress() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const todos = useWorkspaceStore(selectTodosForTopic(activeTopicId));

  const { completed, total, percent } = useMemo(() => {
    const totalCount = todos.length;
    const completedCount = todos.filter(
      (item) => item.status === 'completed' || item.done,
    ).length;
    return {
      completed: completedCount,
      total: totalCount,
      percent: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  }, [todos]);

  if (total === 0) return null;

  return (
    <div className={portalViewStyles.todoCard}>
      <Flexbox horizontal align="center" justify="space-between">
        <Text fontSize={13}>待办进度</Text>
        <Text fontSize={12} type="secondary">
          {completed} / {total}
        </Text>
      </Flexbox>
      <div className={portalViewStyles.todoProgressTrack} style={{ marginTop: 8 }}>
        <div
          className={portalViewStyles.todoProgressFill}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
});
