import { Tag } from '@lobehub/ui';
import { memo } from 'react';

import type { Message } from '../../../domain/types';
import { ClientTaskDetail } from './ClientTaskDetail';
import { TaskChatShell, resolveTaskTitle } from './TaskChatShell';
import { StatusContent } from './StatusContent';

/** §C.47*/
export const TaskMessage = memo(function TaskMessage({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  const title = resolveTaskTitle(message);

  return (
    <TaskChatShell
      agentId={message.agentId}
      createdAt={message.createdAt}
      message={message}
      messageId={message.id}
      title={title}
      topicId={topicId}
      titleAddon={
        <Tag size="small">
          子任务
        </Tag>
      }
    >
      {message.taskDetail?.clientMode ? (
        <ClientTaskDetail message={message} />
      ) : (
        <StatusContent message={message} />
      )}
    </TaskChatShell>
  );
});
