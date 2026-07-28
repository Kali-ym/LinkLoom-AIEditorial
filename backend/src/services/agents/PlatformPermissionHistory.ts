import type { LocalStore } from '../LocalStore.js';

const HISTORY_KEY = 'platform_permission_history';

export interface PlatformPermissionHistoryEntry {
  kind: 'agent' | 'workflow';
  runId: string;
  sessionId?: string;
  agentId?: string;
  workflowId?: string;
  workflowRunId?: string;
  stepId?: string;
  permissionId: string;
  toolName?: string;
  effect: 'allow' | 'deny';
  reason?: string;
  resolvedBy?: string;
  requestedAt: string;
  resolvedAt: string;
}

export async function appendPlatformPermissionHistory(
  store: LocalStore,
  entry: PlatformPermissionHistoryEntry
): Promise<void> {
  const existing = (await store.get(HISTORY_KEY)) as PlatformPermissionHistoryEntry[] | undefined;
  const items = Array.isArray(existing) ? existing : [];
  await store.put(HISTORY_KEY, [entry, ...items].slice(0, 300));
}

export async function listPlatformPermissionHistory(
  store: LocalStore,
  limit = 50
): Promise<PlatformPermissionHistoryEntry[]> {
  const existing = (await store.get(HISTORY_KEY)) as PlatformPermissionHistoryEntry[] | undefined;
  if (!Array.isArray(existing)) return [];
  return existing.slice(0, Math.max(1, limit));
}
