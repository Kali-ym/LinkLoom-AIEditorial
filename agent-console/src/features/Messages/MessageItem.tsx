import { memo, type ReactNode } from 'react';

import type { Message } from '../../domain/types';
import { useChatStore } from '../../stores/chatStore';
import { selectMessagesForTopic } from '../../selectors/storeSelectors';
import { RichAssistantMessageView } from './StreamingAssistantMessage';
import {
  AgentCouncilMessageView,
  CompressedGroupMessageView,
  SupervisorMessageView,
  TaskMessageView,
  TasksBatchMessageView,
  GroupTasksMessageView,
  ToolStandaloneMessageView,
  VerifyMessageView,
} from './ExtendedMessageViews';
import { MessageContextMenu } from '../Overlays/MessageContextMenu';

const EMPTY_MESSAGES: Message[] = [];

/**
 * Computes the 1-based ordinal of a `verify` message among all verify messages
 * in its topic. Subscribes to the topic's message list only for verify messages;
 * other roles return `undefined` and never touch the store, so non-verify
 * MessageItems are not re-rendered when the topic message list reference changes.
 */
function useVerifyOrdinal(topicId: string, message: Message): number | undefined {
  const messages = useChatStore((s) =>
    message.role === 'verify' ? selectMessagesForTopic(topicId)(s) : EMPTY_MESSAGES,
  );
  if (message.role !== 'verify') return undefined;
  return messages.filter((m) => m.role === 'verify').findIndex((m) => m.id === message.id) + 1;
}

/** §C.17 / §C.37 message dispatcher */
export const MessageItem = memo(function MessageItem({
  message,
  topicId,
  defaultWorkflowExpandLevel,
}: {
  message: Message;
  index?: number;
  topicId: string;
  isLastUser?: boolean;
  defaultWorkflowExpandLevel?: { streaming: 'full' };
}) {
  const verifyOrdinal = useVerifyOrdinal(topicId, message);

  const wrap = (node: ReactNode) => (
    <MessageContextMenu message={message} topicId={topicId}>
      {node}
    </MessageContextMenu>
  );

  switch (message.role) {
    case 'supervisor':
      return wrap(<SupervisorMessageView message={message} topicId={topicId} />);
    case 'task':
      return wrap(<TaskMessageView message={message} topicId={topicId} />);
    case 'tool':
      return wrap(<ToolStandaloneMessageView message={message} />);
    case 'verify':
      return wrap(<VerifyMessageView message={message} verifyOrdinal={verifyOrdinal} />);
    case 'compressedGroup':
      return wrap(<CompressedGroupMessageView message={message} topicId={topicId} />);
    case 'tasks':
      return wrap(<TasksBatchMessageView message={message} topicId={topicId} />);
    case 'agentCouncil':
      return wrap(<AgentCouncilMessageView message={message} topicId={topicId} />);
    case 'groupTasks':
      return wrap(<GroupTasksMessageView message={message} topicId={topicId} />);
    case 'assistant':
      return wrap(
        <RichAssistantMessageView
          defaultWorkflowExpandLevel={defaultWorkflowExpandLevel}
          message={message}
          topicId={topicId}
        />,
      );
    default:
      return null;
  }
});

export type { Message };
