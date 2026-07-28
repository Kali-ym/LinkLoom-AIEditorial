import { ContextMenuTrigger, Icon, type GenericItemType } from '@lobehub/ui';
import { Copy, MessageSquareQuote, Split } from 'lucide-react';
import { memo, type ReactNode, useMemo } from 'react';

import type { Message } from '../../domain/types';
import { isTopicStreaming } from '../../services/streaming/streamingScope';
import { getMessagePlainText } from '../../utils/messagePlainText';
import {
  copyMessageText,
  forkTopicAtMessage,
  quoteMessageText,
} from '../Messages/MessageActionBar/messageActionHandlers';
import { messageActionStrings } from '../Messages/MessageActionBar/messageActionStrings';

export interface MessageContextMenuProps {
  children: ReactNode;
  message?: Pick<Message, 'id' | 'role' | 'content' | 'text' | 'linkLine' | 'linkCard'>;
  topicId: string;
}

/** §C — message right-click: copy / quote / fork topic */
export const MessageContextMenu = memo(function MessageContextMenu({
  children,
  message,
  topicId,
}: MessageContextMenuProps) {
  const items = useMemo((): GenericItemType[] => {
    if (!message?.id) return [];

    const plainText = getMessagePlainText(message);
    const hasText = plainText.trim().length > 0;
    const topicStreaming = isTopicStreaming(topicId);

    return [
      {
        disabled: !hasText,
        icon: <Icon icon={Copy} />,
        key: 'copy',
        label: messageActionStrings.copy,
        onClick: () => {
          void copyMessageText(plainText);
        },
      },
      {
        disabled: !hasText,
        icon: <Icon icon={MessageSquareQuote} />,
        key: 'quote',
        label: messageActionStrings.quote,
        onClick: () => quoteMessageText(plainText),
      },
      { type: 'divider' },
      {
        disabled: topicStreaming,
        icon: <Icon icon={Split} />,
        key: 'forkTopic',
        label: messageActionStrings.forkTopic,
        onClick: () => forkTopicAtMessage(topicId, message.id),
      },
    ];
  }, [message, topicId]);

  if (items.length === 0) {
    return <>{children}</>;
  }

  return <ContextMenuTrigger items={items}>{children}</ContextMenuTrigger>;
});
