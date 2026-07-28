import { resolveActiveAgentId } from './agentRun';
import { agentConsoleGetJson, agentConsolePostJson } from './http';
import type { PendingAuthTool } from '../../domain/types/toolAuth';
import { resolveConsoleApiUrl } from '../../domain/connection/consoleConnection';

export async function fetchPendingAuthTools(agentId?: string): Promise<PendingAuthTool[]> {
  const resolvedAgentId = agentId ?? (await resolveActiveAgentId());
  const result = await agentConsoleGetJson<{ tools: PendingAuthTool[] }>(
    `/api/agents/${encodeURIComponent(resolvedAgentId)}/pending-auth-tools`,
  );
  return result.tools;
}

export async function authorizePendingTool(
  agentId: string,
  toolId: string,
): Promise<{ authUrl: string; state: string }> {
  return agentConsolePostJson<{ authUrl: string; state: string }>(
    `/api/agents/${encodeURIComponent(agentId)}/tools/${encodeURIComponent(toolId)}/authorize`,
    {},
  );
}

export function resolveToolAuthPopupUrl(authUrl: string): string {
  if (/^https?:\/\//i.test(authUrl)) return authUrl;
  return resolveConsoleApiUrl(authUrl);
}
