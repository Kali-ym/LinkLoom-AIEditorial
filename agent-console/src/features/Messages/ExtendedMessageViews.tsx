import { Alert, Button, Flexbox, Tag, Text } from '@lobehub/ui';
import { ListTodo } from 'lucide-react';
import { memo } from 'react';

import type { Message } from '../../domain/types';
import { showToast } from '../../services/ui/toast';
import { ChatItem } from '../Conversation/ChatItem/ChatItem';
import { ToolMessage } from './ToolMessage';
import { GroupTasksMessage } from './GroupTasks';
import { TaskMessage } from './Task';
import { TasksMessage } from './Tasks';

/** §C.17 orphan tool */
export const ToolStandaloneMessageView = memo(function ToolStandaloneMessageView({
  message,
}: {
  message: Message;
}) {
  if (!message.tool) return null;

  return (
    <Flexbox gap={8} paddingBlock={8} data-msg-type="tool" id={message.id}>
      <Alert
        action={
          <Button size="small" type="primary" onClick={() => showToast('已删除孤立 tool（演示）')}>
            删除
          </Button>
        }
        title="孤立 tool 调用"
        type="secondary"
      />
      <ToolMessage id={`tool-${message.id}`} tool={message.tool} />
    </Flexbox>
  );
});

/** §C.47 — re-exports for MessageItem */
export const TaskMessageView = memo(function TaskMessageView({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  return <TaskMessage message={message} topicId={topicId} />;
});

export const TasksBatchMessageView = memo(function TasksBatchMessageView({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  return <TasksMessage message={message} topicId={topicId} />;
});

export const GroupTasksMessageView = memo(function GroupTasksMessageView({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  return <GroupTasksMessage message={message} topicId={topicId} />;
});

/** Legacy tag row for showcase */
export const TaskMessageTag = memo(function TaskMessageTag() {
  return (
    <Tag size="small">
      <ListTodo size={12} />
      <span>子任务</span>
    </Tag>
  );
});

/** §C.17 deferred types */
export const DeferredMessageTypeView = memo(function DeferredMessageTypeView({
  message,
}: {
  message: Message;
}) {
  return (
    <ChatItem data-msg-type={message.role} id={message.id} placement="left" showBubble={false}>
      <Text type="secondary">{message.role} 消息（演示占位，见 GAPS §C.17）</Text>
    </ChatItem>
  );
});

export {
  AgentCouncilMessageView,
  CompressedGroupMessageView,
  SupervisorMessageView,
  VerifyMessageView,
} from './SpecialMessageViews';
