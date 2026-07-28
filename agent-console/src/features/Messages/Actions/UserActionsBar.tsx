import { memo, useMemo } from 'react';

import { useTopicStreaming } from '../../../services/streaming/streamingScope';
import { useChatStore } from '../../../stores/chatStore';
import { selectMessageById } from '../../../selectors/storeSelectors';
import {
  USER_DEFAULT_BAR,
  USER_DEFAULT_MENU,
} from '../MessageActionBar/actionsBarConfig';
import { MessageActionBar, type MessageActionContext, type MessageActionsConfig } from '../MessageActionBar';

export const UserMessageActionsBar = memo(function UserMessageActionsBar({
  id,
  topicId,
  isLastUser,
  actionsConfig,
}: {
  id: string;
  index?: number;
  topicId: string;
  isLastUser: boolean;
  actionsConfig?: MessageActionsConfig;
}) {
  const message = useChatStore(selectMessageById(topicId, id));
  const isStreaming = useTopicStreaming(topicId);

  const ctx = useMemo<MessageActionContext | null>(() => {
    if (!message || message.role !== 'user') return null;
    return {
      hasError: Boolean(message.stopped),
      id,
      isLastUser,
      isStreaming,
      message,
      role: 'user',
      topicId,
    };
  }, [id, isLastUser, isStreaming, message, topicId]);

  const config = actionsConfig;

  const bar = useMemo(() => {
    const slots = config?.bar ?? USER_DEFAULT_BAR;
    if (!isLastUser || isStreaming) return slots.filter((key) => key !== 'regenerate');
    return slots;
  }, [config?.bar, isLastUser, isStreaming]);

  if (!ctx) return null;

  return (
    <MessageActionBar
      bar={bar}
      ctx={ctx}
      menu={config?.menu ?? USER_DEFAULT_MENU}
    />
  );
});
