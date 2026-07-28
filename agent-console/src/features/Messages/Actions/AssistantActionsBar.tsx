import { Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { useChatStore } from '../../../stores/chatStore';
import { selectMessageById } from '../../../selectors/storeSelectors';
import {
  ASSISTANT_DEFAULT_BAR,
  ASSISTANT_DEFAULT_BAR_WITH_TOOLS,
  ASSISTANT_DEFAULT_MENU,
  ASSISTANT_ERROR_BAR,
  ASSISTANT_ERROR_MENU,
} from '../MessageActionBar/actionsBarConfig';
import { MessageActionBar, type MessageActionContext, type MessageActionsConfig } from '../MessageActionBar';
import { ReactionPicker } from '../Reaction/ReactionPicker';

export const AssistantMessageActionsBar = memo(function AssistantMessageActionsBar({
  id,
  topicId,
  actionsConfig,
}: {
  id: string;
  topicId: string;
  actionsConfig?: MessageActionsConfig;
}) {
  const message = useChatStore(selectMessageById(topicId, id));
  const streamingId = useChatStore((s) => s.streamingByTopicId[topicId]?.id);
  const collapsed = useChatStore((s) => s.collapsedByMessageId[id] ?? false);

  const ctx = useMemo<MessageActionContext | null>(() => {
    if (!message || message.role !== 'assistant') return null;
    const hasTools = Boolean(message.tool || (message.tools && message.tools.length > 0));
    const hasError = Boolean(message.stopped && !message.content?.trim());
    return {
      hasError,
      hasTools,
      id,
      isCollapsed: collapsed,
      isStreaming: streamingId === id,
      message,
      role: 'assistant',
      topicId,
    };
  }, [collapsed, id, message, streamingId, topicId]);

  const config = actionsConfig;

  const defaultBar = ctx?.hasTools ? ASSISTANT_DEFAULT_BAR_WITH_TOOLS : ASSISTANT_DEFAULT_BAR;

  const bar = useMemo(() => {
    if (!ctx || ctx.hasError) return config?.bar ?? ASSISTANT_ERROR_BAR;
    const slots = config?.bar ?? defaultBar;
    if (!ctx.isStreaming) return slots;
    return slots.filter((key) => key !== 'edit' && key !== 'regenerate');
  }, [config?.bar, ctx, defaultBar]);

  if (!ctx) return null;

  const menu = config?.menu ?? (ctx.hasError ? ASSISTANT_ERROR_MENU : ASSISTANT_DEFAULT_MENU);

  return (
    <Flexbox horizontal align="center" gap={8}>
      <ReactionPicker messageId={id} />
      <MessageActionBar bar={bar} ctx={ctx} menu={menu} />
    </Flexbox>
  );
});
