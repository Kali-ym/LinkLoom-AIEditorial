import { useLayoutStore, usePortalStore, usePortalViewUiStore } from '../../stores';
import type { PortalViewType } from '../../stores/types';
import type { PortalViewPayload } from '../../domain/types/portalView';
import { getAgentConsolePorts } from '../../hooks/data/ports';

function syncMobileOpen(): void {
  if (useLayoutStore.getState().isPortalMobile) {
    usePortalStore.getState().setMobileOpen(true);
  }
}

async function resolvePortalPayload(
  type: PortalViewType,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const resolved = await getAgentConsolePorts().portal.resolveView(
      type,
      payload as PortalViewPayload,
    );
    return resolved as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Portal resolve failed';
    return { ...payload, error: message };
  }
}

function applyResolvedPortalView(
  mode: 'push' | 'replace' | 'reset',
  type: PortalViewType,
  payload: Record<string, unknown>,
): void {
  void resolvePortalPayload(type, payload).then((resolved) => {
    const store = usePortalStore.getState();
    if (mode === 'push') store.pushPortalView(type, resolved);
    else if (mode === 'replace') store.replacePortalView(type, resolved);
    else store.resetPortalView(type, resolved);
    syncMobileOpen();
  });
}

/** Push a view onto the portal stack and open the drawer. */
export function openPortalView(type: PortalViewType, payload: Record<string, unknown> = {}): void {
  applyResolvedPortalView('push', type, payload);
}

/** Replace the top stack frame (or push if empty)*/
export function replacePortalView(
  type: PortalViewType,
  payload: Record<string, unknown> = {},
): void {
  applyResolvedPortalView('replace', type, payload);
}

/** Replace the portal stack with a single view. */
export function resetPortalView(type: PortalViewType, payload: Record<string, unknown> = {}): void {
  applyResolvedPortalView('reset', type, payload);
}

/** Reset stack to Home*/
export function goHomePortal(): void {
  usePortalStore.getState().goHomePortal();
  syncMobileOpen();
}

/** 助手消息「查看详情」→ MessageDetail（优先 messageId） */
export function openMessageDetailPortal(
  messageIdOrContent: string,
  title = '消息详情',
  options?: { mode?: 'messageId' | 'content' },
): void {
  const mode = options?.mode ?? 'messageId';
  if (mode === 'content') {
    resetPortalView('MessageDetail', { title, content: messageIdOrContent });
    return;
  }
  resetPortalView('MessageDetail', { messageId: messageIdOrContent, title });
}

/** 助手消息 / 侧栏分支 → Thread */
export function openThreadPortal(
  title: string,
  threadId?: string,
  options?: { isSubagent?: boolean },
): void {
  const cleanTitle = title.replace(/^分支：/, '').trim();
  resetPortalView('Thread', {
    title: cleanTitle,
    threadId: threadId ?? cleanTitle,
    id: threadId ?? cleanTitle,
    isSubagent: options?.isSubagent,
  });
}

/** Group agent DM → GroupThread */
export function openGroupThreadPortal(agentId: string, title?: string, agentAvatar?: string): void {
  usePortalViewUiStore.getState().setActiveThreadAgentId(agentId);
  resetPortalView('GroupThread', { agentId, title, agentAvatar });
}

/** §C.35*/
export function openToolUI(patch: Record<string, unknown>): void {
  const portal = usePortalStore.getState();
  const current = portal.currentView();
  if (current?.type === 'ToolUI') {
    portal.patchCurrentPayload(patch);
    return;
  }
  resetPortalView('ToolUI', patch);
}
