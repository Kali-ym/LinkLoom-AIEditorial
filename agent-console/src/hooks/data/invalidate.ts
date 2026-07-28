import {
  clearStoredActiveTopicId,
  readStoredActiveTopicId,
  writeStoredActiveTopicId,
} from '../../adapters/api/activeTopicStorage';
import { resolveActiveTopicIdForAgent } from '../../domain/topicAgentScope';
import { readStoredTopicModel } from '../../services/topic/topicModelStorage';
import { queryClient } from '../../layout/SPAGlobalProvider/QueryProvider';
import { getAgentConsolePorts, isAgentConsoleApiMode } from './ports';
import type { Topic } from '../../domain/types';
import {
  getAllClientTopics,
  getClientTopic,
  getForkSeedMessages,
  isClientOnlyTopicId,
  removeClientTopic,
  saveClientTopic,
} from '../../services/topic/clientTopicStorage';
import { mergeForkSeedWithApiMessages } from '../../services/topic/mergeForkMessages';
import { mergeRefreshedMessages } from '../../services/topic/mergeRefreshedMessages';
import {
  clientRecordToTempTopic,
  dedupeEmptyTempTopicsForAgent,
} from '../../services/topic/tempTopicDraft';
import { refreshWorkspaceForTopic } from '../../services/workspace/workspaceSync';
import { useAgentStore, useChatStore, useRouteStore, useTopicStore } from '../../stores';
import { useStreamingStore } from '../../stores/streamingStore';
import { agentConsoleQueryKeys } from './queryKeys';

export async function refreshMessagesForTopic(topicId: string): Promise<void> {
  if (!topicId) return;
  if (isClientOnlyTopicId(topicId)) return;
  if (!isAgentConsoleApiMode()) return;

  const localMessages = useChatStore.getState().getMessages(topicId);
  const apiMessages = await getAgentConsolePorts().chat.getMessages(topicId);
  const forkSeed = getForkSeedMessages(topicId);

  if (forkSeed.length > 0) {
    const merged = mergeForkSeedWithApiMessages(forkSeed, apiMessages);
    useChatStore.getState().setMessages(topicId, merged);
    queryClient.setQueryData(agentConsoleQueryKeys.messages(topicId), merged);

    const snapshot = getClientTopic(topicId);
    if (snapshot) {
      saveClientTopic({
        ...snapshot,
        messages: merged,
        seedMessages: snapshot.seedMessages ?? forkSeed,
      });
    }
    return;
  }

  if (isClientOnlyTopicId(topicId)) {
    if (apiMessages.length === 0) {
      const snapshot = getClientTopic(topicId);
      if (snapshot?.messages.length) {
        useChatStore.getState().setMessages(topicId, snapshot.messages);
        queryClient.setQueryData(agentConsoleQueryKeys.messages(topicId), snapshot.messages);
        return;
      }
      if (localMessages.length > 0) return;
    } else {
      removeClientTopic(topicId);
    }
  }

  useChatStore.getState().setMessages(topicId, mergeRefreshedMessages(localMessages, apiMessages));
  queryClient.setQueryData(
    agentConsoleQueryKeys.messages(topicId),
    mergeRefreshedMessages(localMessages, apiMessages),
  );
}

export async function invalidateMessages(topicId: string): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: agentConsoleQueryKeys.messages(topicId) });
  await queryClient.invalidateQueries({ queryKey: agentConsoleQueryKeys.messagesAll() });
}

/** 切换智能体时立即清空话题 UI，避免旧 agent 的会话残留在对话框中。 */
export function isolateTopicsForAgentSwitch(): void {
  useTopicStore.setState({ activeTopicId: '', topics: [] });
  useRouteStore.getState().showHome();
}

/**
 * 切换 agent 时：缓存离开方话题，并用内存/React Query 缓存即时展示目标方侧栏，避免闪空。
 */
export function prepareTopicsForAgentSwitch(
  previousAgentId: string,
  targetAgentId: string,
): void {
  if (previousAgentId) {
    const topics = useTopicStore.getState().topics;
    if (topics.length > 0) {
      useTopicStore.setState((state) => ({
        topicsByAgentId: { ...state.topicsByAgentId, [previousAgentId]: topics },
      }));
    }
  }

  const cached = useTopicStore.getState().topicsByAgentId[targetAgentId];
  const queryCached = queryClient.getQueryData<Topic[]>(
    agentConsoleQueryKeys.topics(targetAgentId),
  );
  const placeholderTopics = cached?.length ? cached : (queryCached ?? []);

  useTopicStore.setState({
    activeTopicId: '',
    topics: placeholderTopics,
    isRevalidating: Boolean(targetAgentId),
  });
  useRouteStore.getState().showHome();
}

export async function refreshTopicsForAgent(
  agentId: string,
  options?: { preserveActiveTopicId?: boolean; skipTempFallback?: boolean },
): Promise<void> {
  if (!agentId) return;

  const { topics, threadsByTopicId, elapsedByTopicId } =
    await getAgentConsolePorts().topic.getTopicSidebar(agentId);

  const mergedTopics = dedupeEmptyTempTopicsForAgent(
    mergeClientTopicsIntoList(topics, agentId),
    agentId,
  );
  const inMemoryActive = useTopicStore.getState().activeTopicId;
  const storedPreferred = readStoredActiveTopicId(agentId) ?? undefined;
  const preferredId =
    options?.preserveActiveTopicId && inMemoryActive
      ? inMemoryActive
      : (storedPreferred ?? inMemoryActive ?? undefined);
  const streamingTopicIds = new Set(
    Object.entries(useStreamingStore.getState().streamsByTopicId)
      .filter(([, runtime]) => runtime?.isStreaming)
      .map(([topicId]) => topicId),
  );
  const activeTopicId = resolveActiveTopicIdForAgent(mergedTopics, {
    preferredId,
    streamingTopicIds,
    skipTempFallback: options?.skipTempFallback,
  });

  if (useAgentStore.getState().activeAgentId !== agentId) return;

  useTopicStore.getState().hydrate({
    topics: mergedTopics.map((topic) => ({ ...topic, active: topic.id === activeTopicId })),
    activeTopicId,
    threadsByTopicId,
    elapsedByTopicId,
  });

  if (activeTopicId) {
    writeStoredActiveTopicId(activeTopicId, agentId);
    applyActiveTopicRoute(activeTopicId, mergedTopics);
    const storedModel = readStoredTopicModel(activeTopicId);
    if (storedModel) {
      useTopicStore.getState().setTopicModelProvider(activeTopicId, storedModel);
    }
  } else {
    clearStoredActiveTopicId(agentId);
    useRouteStore.getState().showHome();
  }

  queryClient.setQueryData(agentConsoleQueryKeys.topics(agentId), mergedTopics);
}

function mergeClientTopicsIntoList(topics: Topic[], agentId: string): Topic[] {
  const merged = [...topics];
  for (const clientTopic of getAllClientTopics()) {
    if (clientTopic.agentId && clientTopic.agentId !== agentId) continue;
    if (merged.some((topic) => topic.id === clientTopic.id)) continue;
    merged.unshift({
      ...clientRecordToTempTopic(clientTopic, agentId),
      status: clientTopic.messages.length > 0 ? 'completed' : 'temp',
    });
  }
  return merged;
}

function applyActiveTopicRoute(activeTopicId: string, topics: Topic[]): void {
  const topic = topics.find((item) => item.id === activeTopicId);
  if (!topic || topic.status === 'temp') {
    useRouteStore.getState().showHome();
    return;
  }
  useRouteStore.getState().showConversation(topic.title);
}

export async function refreshTopicsForActiveAgent(): Promise<void> {
  await refreshTopicsForAgent(useAgentStore.getState().activeAgentId, {
    preserveActiveTopicId: true,
  });
}

export async function refreshAfterTopicListMutation(
  sourceAgentId: string,
  targetAgentId?: string,
): Promise<void> {
  await refreshTopicsForAgent(sourceAgentId);
  if (targetAgentId && targetAgentId !== sourceAgentId) {
    await refreshTopicsForAgent(targetAgentId);
  }
}

export async function refreshAgentList(): Promise<void> {
  if (!isAgentConsoleApiMode()) return;

  const ports = getAgentConsolePorts();
  const [agents, layout, runtimeByAgentId, plusStateByAgentId] = await Promise.all([
    ports.agent.listAgents(),
    ports.agentList.getLayout(),
    ports.agentList.getRuntimeByAgentId(),
    ports.agent.getPlusStateMap(),
  ]);

  const activeAgentId = useAgentStore.getState().activeAgentId;
  useAgentStore.getState().hydrate({ activeAgentId, agents, plusStateByAgentId });
  useAgentStore.getState().finishConfigLoad();

  queryClient.setQueryData(agentConsoleQueryKeys.agents(), agents);
  queryClient.setQueryData(agentConsoleQueryKeys.agentListBundle(), {
    agents,
    layout,
    plusStateByAgentId,
    runtimeByAgentId,
  });
  queryClient.setQueryData(agentConsoleQueryKeys.agentListLayout(), layout);
  queryClient.setQueryData(agentConsoleQueryKeys.agentRuntime(), runtimeByAgentId);

  await queryClient.invalidateQueries({ queryKey: agentConsoleQueryKeys.agentListBundle() });
}

export async function refreshAfterConversationTurn(topicId: string): Promise<void> {
  await refreshMessagesForTopic(topicId);
  await refreshWorkspaceForTopic(topicId);
  await refreshTopicsForActiveAgent();
}
