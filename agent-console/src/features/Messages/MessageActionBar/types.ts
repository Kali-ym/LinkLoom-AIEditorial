import type { ActionIconGroupItemType } from '@lobehub/ui';

import type { Message } from '../../../domain/types';

export type MessageActionRole = 'assistant' | 'group' | 'user';

export interface MessageActionContext {
  contentBlockId?: string;
  hasError?: boolean;
  hasTools?: boolean;
  id: string;
  isCollapsed?: boolean;
  isLastUser?: boolean;
  isStreaming?: boolean;
  message: Message;
  role: MessageActionRole;
  topicId: string;
}

export interface MessageActionItem extends ActionIconGroupItemType {
  children?: Array<{ handleClick?: () => void; key: string; label: string }>;
  handleClick?: () => void | Promise<void>;
}

export type MessageActionItemOrDivider = MessageActionItem | { type: 'divider' };

export type MessageActionSlot = string;

export const DIVIDER_KEY = 'divider';

export interface MessageActionsConfig {
  bar?: MessageActionSlot[];
  menu?: MessageActionSlot[];
}
