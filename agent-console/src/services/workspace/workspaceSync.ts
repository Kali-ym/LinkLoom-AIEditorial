import { agentConsoleGetJson } from '../../adapters/api/http';
import { topicIdToSessionId } from '../../adapters/api/mappers/sessionTopic';
import {
  deriveWorkspacePatchFromTools,
  extractMutatedWorkspacePathsFromTools,
  mapBackendTodosToDomain,
  normalizeWorkspaceRelativePath,
  type BackendWorkspaceState,
} from '../../adapters/api/mappers/workspaceState';
import { deriveWebPagesFromTools } from '../../adapters/api/mappers/webBrowsingState';
import { replacePortalView } from '../../features/Portal/portalActions';
import { isAgentConsoleApiMode } from '../../hooks/data/ports';
import type { ToolPayload } from '../../domain/types';
import { useAgentStore, usePortalStore, useWorkspaceStore } from '../../stores';

export async function fetchWorkspaceForTopic(topicId: string) {
  const sessionId = topicIdToSessionId(topicId);
  const session = await agentConsoleGetJson<{ workspaceState?: BackendWorkspaceState | null }>(
    `/api/agent-sessions/${encodeURIComponent(sessionId)}`,
  );
  const workspaceState = session.workspaceState ?? undefined;
  return {
    todos: mapBackendTodosToDomain(workspaceState?.todos),
    plan: workspaceState?.plan,
  };
}

export function applyWorkspaceFromToolPayloads(topicId: string, tools: ToolPayload[]): void {
  const patch = deriveWorkspacePatchFromTools(tools);
  const webPages = deriveWebPagesFromTools(tools);
  const store = useWorkspaceStore.getState();

  if (patch) {
    if (patch.todos !== undefined) store.setTodos(topicId, patch.todos);
    if (patch.plan !== undefined) store.setPlan(topicId, patch.plan);
  }
  if (webPages.length) store.mergeWebPages(topicId, webPages);

  const mutatedPaths = extractMutatedWorkspacePathsFromTools(tools);
  if (!mutatedPaths.length) return;

  const agentId = useAgentStore.getState().activeAgentId;
  if (agentId) {
    void store.refreshWorkspaceDocuments(agentId);
  }

  const portal = usePortalStore.getState().currentView();
  if (portal?.type !== 'Document' || typeof portal.payload?.path !== 'string') return;

  const openPath = normalizeWorkspaceRelativePath(portal.payload.path);
  if (!mutatedPaths.some((path) => path === openPath)) return;

  replacePortalView('Document', {
    ...portal.payload,
    agentId: (portal.payload.agentId as string | undefined) ?? agentId,
  });
}

export async function refreshWorkspaceForTopic(topicId: string): Promise<void> {
  if (!topicId || !isAgentConsoleApiMode()) return;
  try {
    const { todos, plan } = await fetchWorkspaceForTopic(topicId);
    const store = useWorkspaceStore.getState();
    store.setTodos(topicId, todos);
    store.setPlan(topicId, plan);
  } catch (error) {
    console.error('[agentConsole] refresh workspace failed', error);
  }
}
