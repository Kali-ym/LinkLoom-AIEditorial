import { createContext, memo, type PropsWithChildren, use, useMemo } from 'react';

import type { Message, Topic } from '../../domain/types';
import { useAgentStore, useChatStore, useTopicStore } from '../../stores';

interface ShareDataContextValue {
  agentName: string;
  dbMessages: Message[];
  displayMessages: Message[];
  isLoading: boolean;
  systemRole: string;
  title: string;
  topic?: Topic;
  topicId: string;
}

const ShareDataContext = createContext<ShareDataContextValue | null>(null);

interface ShareDataProviderProps {
  topicId: string;
}

export const ShareDataProvider = memo(function ShareDataProvider({
  children,
  topicId,
}: PropsWithChildren<ShareDataProviderProps>) {
  const topic = useTopicStore((s) => s.topics.find((t) => t.id === topicId));
  const getMessages = useChatStore((s) => s.getMessages);
  const agentName = useAgentStore((s) => s.getActiveAgent().name);
  const systemRole = useAgentStore((s) => s.getChatConfig().inputTemplate ?? '');

  const messages = useMemo(() => getMessages(topicId), [getMessages, topicId]);

  const value = useMemo<ShareDataContextValue>(
    () => ({
      agentName,
      dbMessages: messages,
      displayMessages: messages,
      isLoading: false,
      systemRole,
      title: topic?.title || '导出对话',
      topic,
      topicId,
    }),
    [agentName, messages, systemRole, topic, topicId],
  );

  return <ShareDataContext value={value}>{children}</ShareDataContext>;
});

export function useShareData(): ShareDataContextValue {
  const context = use(ShareDataContext);
  if (!context) {
    throw new Error('useShareData must be used within ShareDataProvider');
  }
  return context;
}
