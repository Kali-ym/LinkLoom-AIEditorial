import { queryClient } from '../../layout/SPAGlobalProvider/QueryProvider';
import type { Message } from '../../domain/types';
import { agentConsoleQueryKeys } from './queryKeys';

/** Keep TanStack Query cache aligned when chatStore mutates topic messages. */
export function syncTopicMessagesQuery(topicId: string, messages: Message[]): void {
  queryClient.setQueryData(agentConsoleQueryKeys.messages(topicId), messages);
  queryClient.setQueryData(
    agentConsoleQueryKeys.messagesAll(),
    (prev: Record<string, Message[]> | undefined) => ({
      ...(prev ?? {}),
      [topicId]: messages,
    }),
  );
}
