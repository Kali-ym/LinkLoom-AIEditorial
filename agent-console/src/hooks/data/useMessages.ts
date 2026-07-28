import { useQuery } from '@tanstack/react-query';

import { queryClient } from '../../layout/SPAGlobalProvider/QueryProvider';
import type { Message } from '../../domain/types';
import { refreshMessagesForTopic } from './invalidate';
import { isEphemeralTopicId } from '../../adapters/api/mappers/sessionTopic';
import { getAgentConsolePorts, isAgentConsoleApiMode } from './ports';
import { agentConsoleQueryKeys } from './queryKeys';

const EMPTY_MESSAGES: Message[] = [];

/** Topic message list via TanStack Query; store remains source for streaming optimistic updates. */
export function useMessages(topicId: string | null | undefined) {
  const id = topicId ?? '';
  const isEphemeral = Boolean(topicId && isEphemeralTopicId(topicId));

  return useQuery<Message[]>({
    enabled: Boolean(topicId) && !isEphemeral,
    queryKey: agentConsoleQueryKeys.messages(id),
    queryFn: async () => {
      if (!topicId) return EMPTY_MESSAGES;

      if (isAgentConsoleApiMode()) {
        await refreshMessagesForTopic(topicId);
        return (
          queryClient.getQueryData<Message[]>(agentConsoleQueryKeys.messages(topicId)) ??
          EMPTY_MESSAGES
        );
      }

      return getAgentConsolePorts().chat.getMessages(topicId);
    },
    placeholderData: (previousData, previousQuery) => {
      const prevTopicId = previousQuery?.queryKey[2];
      if (typeof prevTopicId === 'string' && prevTopicId === id) {
        return previousData;
      }
      return undefined;
    },
    staleTime: 30_000,
  });
}
