import { Flexbox, Text } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo, type ReactNode } from 'react';

import type { Message } from '../../../domain/types';
import {
  CHAT_AGENT_AVATAR_SIZE,
  CHAT_AGENT_NAME_FONT_SIZE,
} from '../../../constants/layoutTokens';
import { chatItemStyles } from '../../Conversation/ChatItem/chatItemStyles';
import { useAgentStore } from '../../../stores';
import { AgentAvatar } from '../../../utils/agentAvatar';
import { formatMessageTime } from '../../../utils/userMessageContent';
import { TaskAvatar } from '../Tasks/shared';
import { TaskAssistantActionsBar } from './Actions';

/** §C.47 — ChatItem + TaskAvatar + title row + hover actions */
export const TaskChatShell = memo(function TaskChatShell({
  agentId,
  children,
  createdAt,
  message,
  messageId,
  title,
  titleAddon,
  topicId,
}: {
  agentId?: string;
  children: ReactNode;
  createdAt?: string;
  message?: Message;
  messageId: string;
  title: string;
  titleAddon?: ReactNode;
  topicId?: string;
}) {
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === agentId));

  const actions =
    topicId && message ? (
      <TaskAssistantActionsBar id={messageId} message={message} topicId={topicId} />
    ) : null;

  return (
    <Flexbox
      className={cx(chatItemStyles.container, 'task-message-shell')}
      data-message
      data-message-id={messageId}
      data-msg-type="task-shell"
      gap={8}
      paddingBlock={8}
      style={{ width: '100%' }}
    >
      <Flexbox horizontal align="flex-start" gap={12} style={{ width: '100%' }}>
        <TaskAvatar>
          <AgentAvatar
            agent={{ id: agentId ?? 'task', name: agent?.name ?? 'T' }}
            background={agent?.gradient}
            size={CHAT_AGENT_AVATAR_SIZE}
          />
        </TaskAvatar>
        <Flexbox flex={1} gap={8} style={{ minWidth: 0 }}>
          <Flexbox horizontal align="center" gap={8} wrap="wrap">
            <Text ellipsis fontSize={CHAT_AGENT_NAME_FONT_SIZE} weight={600}>
              {title}
            </Text>
            {titleAddon}
            {createdAt ? (
              <Text fontSize={12} type="secondary">
                {formatMessageTime(createdAt)}
              </Text>
            ) : null}
          </Flexbox>
          {children}
        </Flexbox>
      </Flexbox>
      {actions ? (
        <Flexbox horizontal align="center" gap={8} role="menubar" style={{ paddingInlineStart: CHAT_AGENT_AVATAR_SIZE + 12 }}>
          {actions}
        </Flexbox>
      ) : null}
    </Flexbox>
  );
});

export function resolveTaskTitle(message: Message): string {
  return (
    message.metadata?.taskTitle ??
    message.taskTitle ??
    message.taskDetail?.title ??
    '子任务'
  );
}
