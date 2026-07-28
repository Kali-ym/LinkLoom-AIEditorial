import { Block, Flexbox, GroupAvatar, Icon, Tag } from '@lobehub/ui';
import { cssVar, cx } from 'antd-style';
import { ListTodo } from 'lucide-react';
import { memo, useMemo, type ReactNode } from 'react';

import type { Message } from '../../../domain/types';
import { useAgentStore } from '../../../stores';
import { AgentAvatar, resolveAgentAvatar } from '../../../utils/agentAvatar';
import { formatMessageTime } from '../../../utils/userMessageContent';
import { chatItemStyles } from '../../Conversation/ChatItem/chatItemStyles';
import { TaskAssistantActionsBar } from '../Task/Actions';
import { TaskItem } from '../Tasks/TaskItem';

const GroupTasksAvatar = memo(function GroupTasksAvatar({
  avatars,
}: {
  avatars: Array<{ avatar?: string | ReactNode; background?: string }>;
}) {
  return (
    <Flexbox flex="none" height={28} style={{ position: 'relative' }} width={28}>
      <GroupAvatar
        avatarShape="square"
        avatars={avatars.map((a) => ({
          avatar: a.avatar ?? 'A',
          background: a.background,
        }))}
        cornerShape="square"
        size={28}
      />
      <Block
        align="center"
        flex="none"
        height={16}
        justify="center"
        variant="outlined"
        width={16}
        style={{ borderRadius: 4, position: 'absolute', right: -4, top: -4 }}
      >
        <Icon color={cssVar.colorTextDescription} icon={ListTodo} size={10} />
      </Block>
    </Flexbox>
  );
});

function buildGroupTitle(agentNames: string[], taskCount: number): string {
  if (agentNames.length === 0) return `${taskCount} 个并行任务`;
  const displayed = agentNames.slice(0, 2).join(' / ');
  if (agentNames.length <= 2) return `${displayed} 共 ${taskCount} 个任务`;
  return `${displayed} 和 ${agentNames.length} 个代理任务`;
}

/** §C.47*/
export const GroupTasksMessage = memo(function GroupTasksMessage({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  const tasks = message.tasks?.filter(Boolean);
  const agents = useAgentStore((s) => s.agents);

  const taskAgents = useMemo(() => {
    if (!tasks?.length) return [];
    const ids = [...new Set(tasks.map((t) => t.agentId).filter(Boolean))] as string[];
    return ids
      .map((id) => agents.find((a) => a.id === id))
      .filter(Boolean)
      .map((a) => ({
        avatar: resolveAgentAvatar(a!, 11),
        background: a!.gradient,
        title: a!.name,
      }));
  }, [agents, tasks]);

  const title = useMemo(
    () => buildGroupTitle(taskAgents.map((a) => a.title), tasks?.length ?? 0),
    [taskAgents, tasks?.length],
  );

  if (!tasks?.length) return null;

  return (
    <Flexbox
      className={cx(chatItemStyles.container, 'group-tasks-message')}
      data-message-id={message.id}
      data-msg-type="groupTasks"
      gap={8}
      paddingBlock={8}
      style={{ width: '100%' }}
    >
      <Flexbox horizontal align="flex-start" gap={12}>
        <GroupTasksAvatar avatars={taskAgents} />
        <Flexbox flex={1} gap={8} style={{ minWidth: 0 }}>
          <Flexbox horizontal align="center" gap={8} wrap="wrap">
            <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
            <Tag size="small">{tasks.length} 个并行任务</Tag>
            <span style={{ fontSize: 12, color: cssVar.colorTextSecondary }}>
              {formatMessageTime(message.createdAt)}
            </span>
          </Flexbox>
          <Flexbox gap={8} style={{ width: '100%' }}>
            {tasks.map((task) => (
              <GroupTaskItem key={task.id} task={task} />
            ))}
          </Flexbox>
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal align="center" gap={8} role="menubar" style={{ paddingInlineStart: 40 }}>
        <TaskAssistantActionsBar id={message.id} message={message} topicId={topicId} />
      </Flexbox>
    </Flexbox>
  );
});

const GroupTaskItem = memo(function GroupTaskItem({ task }: { task: Message }) {
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === task.agentId));
  return (
    <Flexbox gap={4} style={{ width: '100%' }}>
      {agent ? (
        <Flexbox horizontal align="center" gap={6} style={{ paddingInline: 4 }}>
          <AgentAvatar agent={agent} background={agent.gradient} shape="circle" size={20} />
          <span style={{ fontSize: 12, color: cssVar.colorTextSecondary }}>{agent.name}</span>
        </Flexbox>
      ) : null}
      <TaskItem item={task} />
    </Flexbox>
  );
});
