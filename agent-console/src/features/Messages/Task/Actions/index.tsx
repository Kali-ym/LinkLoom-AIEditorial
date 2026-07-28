import { memo, useMemo } from 'react';

import type { Message } from '../../../../domain/types';
import {
  TASK_DEFAULT_BAR,
  TASK_DEFAULT_BAR_WITH_TOOLS,
  TASK_DEFAULT_MENU,
  TASK_ERROR_BAR,
  TASK_ERROR_MENU,
} from '../../MessageActionBar/taskActionsBarConfig';
import {
  MessageActionBar,
  type MessageActionContext,
  type MessageActionsConfig,
} from '../../MessageActionBar';
import { isTaskErrorStatus } from '../../Tasks/shared/utils';

function messageHasTaskTools(message: Message): boolean {
  if (message.taskThreadMessages?.some((m) => m.children?.some((b) => b.tools?.length))) {
    return true;
  }
  return Boolean(message.tasks?.some((task) => messageHasTaskTools(task)));
}

function messageHasTaskError(message: Message): boolean {
  const status = message.taskDetail?.status ?? message.taskStatus;
  if (status && isTaskErrorStatus(status as import('../../../../domain/types/taskMessage').TaskThreadStatus)) {
    return true;
  }
  return Boolean(message.tasks?.some((task) => messageHasTaskError(task)));
}

interface TaskAssistantActionsBarProps {
  actionsConfig?: MessageActionsConfig;
  id: string;
  message: Message;
  topicId: string;
}

/** §C.47 / §C.25*/
export const TaskAssistantActionsBar = memo(function TaskAssistantActionsBar({
  actionsConfig,
  id,
  message,
  topicId,
}: TaskAssistantActionsBarProps) {
  const ctx = useMemo<MessageActionContext>(
    () => ({
      hasError: messageHasTaskError(message),
      hasTools: messageHasTaskTools(message),
      id,
      message,
      role: 'assistant',
      topicId,
    }),
    [id, message, topicId],
  );

  if (ctx.hasError) {
    return (
      <MessageActionBar
        bar={actionsConfig?.bar ?? TASK_ERROR_BAR}
        ctx={ctx}
        menu={actionsConfig?.menu ?? TASK_ERROR_MENU}
      />
    );
  }

  const defaultBar = ctx.hasTools ? TASK_DEFAULT_BAR_WITH_TOOLS : TASK_DEFAULT_BAR;

  return (
    <MessageActionBar
      bar={actionsConfig?.bar ?? defaultBar}
      ctx={ctx}
      menu={actionsConfig?.menu ?? TASK_DEFAULT_MENU}
    />
  );
});
