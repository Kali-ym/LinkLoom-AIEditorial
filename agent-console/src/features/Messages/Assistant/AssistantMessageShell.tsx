import { Flexbox, Text } from '@lobehub/ui';
import { memo, useCallback, type MouseEventHandler, type ReactNode } from 'react';

import {
  CHAT_AGENT_AVATAR_SIZE,
  CHAT_AGENT_NAME_FONT_SIZE,
} from '../../../constants/layoutTokens';
import { useAgentDisplay } from '../../../hooks/useAgentDisplay';
import { AgentAvatar } from '../../../utils/agentAvatar';
import { ChatItem } from '../../Conversation/ChatItem/ChatItem';
import {
  useSetMessageItemActionElementPortialContext,
  useSetMessageItemActionTypeContext,
} from '../Contexts/message-action-context';
import { AssistantMessageActionsPortal } from './AssistantMessageActionsPortal';

/** §C.11 assistant shell — ChatItem left, no bubble, width 100% */
export const AssistantMessageShell = memo(function AssistantMessageShell({
  agentId,
  agentName: agentNameProp,
  time,
  children,
  className,
  id,
  index = 0,
  loading,
  stopped,
  topicId,
}: {
  agentId?: string;
  agentName?: string;
  time: string;
  children: ReactNode;
  className?: string;
  id?: string;
  index?: number;
  loading?: boolean;
  stopped?: boolean;
  topicId?: string;
}) {
  const { name: resolvedName, gradient, id: resolvedId } = useAgentDisplay(agentId);
  const agentName = agentNameProp ?? resolvedName;
  const setPortalElement = useSetMessageItemActionElementPortialContext();
  const setActionType = useSetMessageItemActionTypeContext();

  const onMouseEnter: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (!id || !topicId) return;
      setPortalElement(e.currentTarget);
      setActionType({ id, index, type: 'assistant' });
    },
    [id, index, setActionType, setPortalElement, topicId],
  );

  return (
    <ChatItem
      actions={topicId && id ? <AssistantMessageActionsPortal /> : undefined}
      className={className}
      data-msg-type="assistant"
      id={id}
      loading={loading}
      placement="left"
      showBubble={false}
      showTitle
      time={time}
      titleAddon={
        <Flexbox horizontal align="center" gap={8}>
          <AgentAvatar
            agent={{ id: agentId ?? resolvedId, name: agentName }}
            background={gradient}
            size={CHAT_AGENT_AVATAR_SIZE}
          />
          <Text fontSize={CHAT_AGENT_NAME_FONT_SIZE} weight={500}>
            {agentName}
          </Text>
        </Flexbox>
      }
      onMouseEnter={onMouseEnter}
    >
      {children}
      {stopped && (
        <Text fontSize={13} type="secondary">
          生成已停止
        </Text>
      )}
    </ChatItem>
  );
});
