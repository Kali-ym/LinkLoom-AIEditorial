import { seedStoresFromPorts } from '../adapters/mock/bootstrapSeed';
import { getMockWorkspaceControlsSeed } from '../adapters/mock/seeds/workspaceControlsSeed';
import { isAgentConsoleApiMode } from '../adapters/registry';
import type { AgentConsoleSnapshot } from '../adapters/types';
import { seedAgentConsoleQueryCache } from '../hooks/data/prefetch';
import { queryClient } from '../layout/SPAGlobalProvider/QueryProvider';
import { useStreamingStore } from './streamingStore';
import { DEFAULT_CONVERSATION_TITLE } from './types';
import { useLayoutStore } from './layoutStore';
import { useRouteStore } from './routeStore';
import { useTopicStore } from './topicStore';
import { useAgentStore } from './agentStore';
import { useAgentListStore } from './agentListStore';
import { useConfigStore } from './configStore';
import { useShareStore } from './shareStore';
import { useChatStore } from './chatStore';
import { useTaskStore } from './taskStore';
import { useToolAuthStore } from './toolAuthStore';
import { useWorkspaceStore } from './workspaceStore';
import { useWorkspaceControlsStore } from './workspaceControlsStore';

export { useLayoutStore, initLayoutListeners } from './layoutStore';
export { useRouteStore } from './routeStore';
export { filterTopics, useTopicStore } from './topicStore';
export { useChatStore } from './chatStore';
export { useStreamingStore } from './streamingStore';
export { useInputStore } from './inputStore';
export { usePortalStore } from './portalStore';
export { usePortalViewUiStore } from './portalViewUiStore';
export { useWorkingSidebarStore } from './workingSidebarStore';
export { useCommandMenuStore } from './commandMenuStore';
export { useAgentStore } from './agentStore';
export { useAgentListStore } from './agentListStore';
export { useConfigStore } from './configStore';
export { useShareStore } from './shareStore';
export { orderTaskGroups, useTaskStore } from './taskStore';
export { useWorkspaceStore } from './workspaceStore';
export { useWorkspaceControlsStore } from './workspaceControlsStore';
export * from './types';

let elapsedTimerId: number | null = null;
let isBootstrapped = false;
let isBootstrapComplete = false;
let bootstrapCompleteResolve: (() => void) | null = null;
let bootstrapCompletePromise: Promise<void> | null = null;

function getBootstrapCompletePromise(): Promise<void> {
  if (isBootstrapComplete) return Promise.resolve();
  if (!bootstrapCompletePromise) {
    bootstrapCompletePromise = new Promise<void>((resolve) => {
      bootstrapCompleteResolve = resolve;
    });
  }
  return bootstrapCompletePromise;
}

export function isAgentConsoleBootstrapComplete(): boolean {
  return isBootstrapComplete;
}

/** Resolves when the first bootstrap pass finishes (success or failure). */
export function whenAgentConsoleBootstrapComplete(): Promise<void> {
  return getBootstrapCompletePromise();
}

function markBootstrapComplete(): void {
  isBootstrapComplete = true;
  bootstrapCompleteResolve?.();
  bootstrapCompleteResolve = null;
  bootstrapCompletePromise = null;
}

function applyUiDefaults(activeTopicId?: string): void {
  const topicId = activeTopicId ?? useTopicStore.getState().activeTopicId;
  const topic = useTopicStore.getState().topics.find((t) => t.id === topicId);
  if (topic?.status === 'temp' || !topicId) {
    useRouteStore.getState().showHome();
  } else if (topic) {
    useRouteStore.getState().showConversation(topic.title ?? DEFAULT_CONVERSATION_TITLE);
  } else {
    useRouteStore.getState().showHome();
  }
  if (!isAgentConsoleApiMode()) {
    const topicId = activeTopicId ?? useTopicStore.getState().activeTopicId;
    if (topicId) {
      useStreamingStore.getState().seedQueueDemo(topicId);
    }
    useTaskStore.getState().selectTask('task-changelog');
    useTaskStore.getState().setRouteTaskId('changelog');
  }
  useLayoutStore.getState().applyCssVars();

  if (elapsedTimerId == null) {
    elapsedTimerId = window.setInterval(() => {
      useTopicStore.getState().tickElapsed();
    }, 1000);
  }
}

function applyHydrate(
  hydrate: AgentConsoleSnapshot,
  agentListLayout: AgentConsoleSnapshot['agentListLayout'],
): void {
  useAgentStore.getState().hydrate(hydrate);
  useAgentListStore.getState().hydrate(hydrate);
  if (!agentListLayout.isAgentListInit) {
    useAgentListStore.getState().finishAgentListInit();
  }
  useTopicStore.getState().hydrate(hydrate);
  useChatStore.getState().hydrate(hydrate);
  useWorkspaceStore.getState().hydrate(hydrate, hydrate.activeTopicId);
  useTaskStore.getState().hydrate(hydrate);
  useConfigStore.getState().hydrate(hydrate);
  useShareStore.getState().hydrate(hydrate);
  useToolAuthStore.getState().hydrate(hydrate.pendingAuthTools);

  seedAgentConsoleQueryCache(queryClient, hydrate);
  useAgentStore.getState().finishConfigLoad();
}

function runPortBootstrap(): void {
  isBootstrapComplete = false;
  bootstrapCompletePromise = null;
  bootstrapCompleteResolve = null;
  void getBootstrapCompletePromise();
  void seedStoresFromPorts()
    .then(({ agentListLayout, hydrate }) => {
      applyHydrate(hydrate, agentListLayout);
      if (!isAgentConsoleApiMode()) {
        useWorkspaceControlsStore.getState().hydrateWorkspaceControls(getMockWorkspaceControlsSeed());
      }
      applyUiDefaults(hydrate.activeTopicId);
    })
    .catch((error) => {
      console.error('[agentConsole] bootstrap failed', error);
      applyUiDefaults();
      useAgentStore.getState().finishConfigLoad();
    })
    .finally(() => {
      markBootstrapComplete();
    });
}

/** UI defaults + port-aligned store seed via async port gather. */
export function bootstrapAgentConsole(): void {
  if (isBootstrapped) return;
  isBootstrapped = true;
  runPortBootstrap();
}

export function teardownAgentConsole(): void {
  if (elapsedTimerId != null) {
    window.clearInterval(elapsedTimerId);
    elapsedTimerId = null;
  }
  isBootstrapped = false;
  isBootstrapComplete = false;
  bootstrapCompleteResolve?.();
  bootstrapCompleteResolve = null;
  bootstrapCompletePromise = null;
}
