import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';

/** §C.54*/
export const TaskActivities = memo(function TaskActivities() {
  const activities = useTaskDetailPageStore((s) => s.detail?.activities ?? []);

  if (activities.length === 0) {
    return (
      <Text type="secondary" fontSize={12}>
        暂无活动记录
      </Text>
    );
  }

  return (
    <Flexbox gap={8}>
      {activities.map((activity) => (
        <Flexbox key={activity.id} horizontal justify="space-between" gap={12}>
          <Text>{activity.label}</Text>
          <Text fontSize={12} type="secondary">
            {new Date(activity.at).toLocaleString()}
          </Text>
        </Flexbox>
      ))}
    </Flexbox>
  );
});
