import { Flexbox, Tag } from '@lobehub/ui';
import { memo } from 'react';

import type { Message } from '../../../domain/types';
import { TaskChatShell } from '../Task/TaskChatShell';
import { TaskItem } from './TaskItem';

/** §C.47*/
export const TasksMessage = memo(function TasksMessage({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  const tasks = message.tasks?.filter(Boolean);
  if (!tasks?.length) return null;

  const firstAgentId = tasks[0]?.agentId;

  return (
    <TaskChatShell
      agentId={firstAgentId}
      createdAt={message.createdAt}
      message={message}
      messageId={message.id}
      title="批量子任务"
      topicId={topicId}
      titleAddon={<Tag size="small">{tasks.length} 个批量子任务</Tag>}
    >
      <Flexbox gap={8} style={{ width: '100%' }}>
        {tasks.map((task) => (
          <TaskItem item={task} key={task.id} />
        ))}
      </Flexbox>
    </TaskChatShell>
  );
});
