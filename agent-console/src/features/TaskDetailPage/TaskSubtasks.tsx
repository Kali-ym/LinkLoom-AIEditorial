import { Checkbox, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import type { TaskDetailSubtask } from '../../domain/types/taskDetailPage';
import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';

/** §C.54*/
export const TaskSubtasks = memo(function TaskSubtasks() {
  const subtasks = useTaskDetailPageStore((s) => s.detail?.subtasks ?? []);
  const toggleSubtask = useTaskDetailPageStore((s) => s.toggleSubtask);
  const updateSubtaskTitle = useTaskDetailPageStore((s) => s.updateSubtaskTitle);

  if (subtasks.length === 0) {
    return (
      <Text type="secondary" fontSize={12}>
        暂无子任务
      </Text>
    );
  }

  return (
    <Flexbox gap={8}>
      {subtasks.map((task) => (
        <SubtaskRow
          key={task.id}
          task={task}
          onToggle={() => toggleSubtask(task.id)}
          onTitleChange={(title) => updateSubtaskTitle(task.id, title)}
        />
      ))}
    </Flexbox>
  );
});

const SubtaskRow = memo(function SubtaskRow({
  task,
  onToggle,
  onTitleChange,
}: {
  task: TaskDetailSubtask;
  onToggle: () => void;
  onTitleChange: (title: string) => void;
}) {
  return (
    <Flexbox horizontal align="center" gap={8}>
      <Checkbox checked={task.done} onChange={onToggle} />
      <input
        value={task.title}
        onChange={(e) => onTitleChange(e.target.value)}
        style={{
          background: 'transparent',
          border: 'none',
          flex: 1,
          fontSize: 14,
          outline: 'none',
          textDecoration: task.done ? 'line-through' : undefined,
          color: task.done ? 'var(--console-vars-colorTextSecondary)' : undefined,
        }}
      />
    </Flexbox>
  );
});
