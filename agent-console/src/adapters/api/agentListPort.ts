import type { IAgentListPort } from '../ports/IAgentListPort';
import type { AgentListLayout, AgentRuntimeStatus } from '../../domain/types';
import { DEFAULT_AGENT_PAGE_SIZE } from '../../domain/types/agentList';
import type { Agent } from '../../domain/types';
import { resolvePrimaryAgentId } from '../../domain/resolvePrimaryAgent';
import { apiAgentPort } from './agentPort';
import { readAgentListLayoutPrefs } from './agentListLayoutStorage';
import { agentConsoleGetJson } from './http';
import type { BackendAgentRunPageDto } from './types/session';

const ACTIVE_RUN_STATUSES = new Set(['queued', 'running', 'paused', 'cancelling']);

async function listRecentRuns(limit = 200): Promise<BackendAgentRunPageDto> {
  const params = new URLSearchParams({
    limit: String(limit),
    sortField: 'updatedAt',
    sortOrder: 'desc',
  });
  return agentConsoleGetJson<BackendAgentRunPageDto>(`/api/agent-runs?${params.toString()}`);
}

function buildDefaultLayout(agents: Agent[]): AgentListLayout {
  const prefs = readAgentListLayoutPrefs();
  const agentIds = agents.map((agent) => agent.id);
  const knownIds = new Set(agentIds);
  const pinnedAgentIds = (prefs?.pinnedAgentIds ?? []).filter((id) => knownIds.has(id));
  const pinnedSet = new Set(pinnedAgentIds);
  const ungroupedFromPrefs = (prefs?.ungroupedAgentIds ?? []).filter(
    (id) => knownIds.has(id) && !pinnedSet.has(id),
  );
  const ungroupedAgentIds =
    ungroupedFromPrefs.length > 0
      ? ungroupedFromPrefs
      : agentIds.filter((id) => !pinnedSet.has(id));

  const groups =
    prefs?.groups?.map((group) => ({
      ...group,
      itemIds: group.itemIds.filter((id) => knownIds.has(id) && !pinnedSet.has(id)),
    })) ?? [];

  return {
    inboxAgentId: resolvePrimaryAgentId(agents),
    pinnedAgentIds,
    groups,
    ungroupedAgentIds,
    expandedGroupIds: prefs?.expandedGroupIds ?? [],
    agentPageSize: prefs?.agentPageSize ?? DEFAULT_AGENT_PAGE_SIZE,
    isAgentListInit: false,
  };
}

function buildRuntimeMap(
  runs: BackendAgentRunPageDto['items'],
  agentIds: string[],
): Record<string, AgentRuntimeStatus> {
  const runtime: Record<string, AgentRuntimeStatus> = Object.fromEntries(
    agentIds.map((id) => [id, { isRunning: false, unreadCount: 0 }]),
  );

  for (const run of runs) {
    if (!run.agentId || !ACTIVE_RUN_STATUSES.has(run.status)) continue;
    runtime[run.agentId] = {
      ...runtime[run.agentId],
      isRunning: true,
    };
  }

  return runtime;
}

export const apiAgentListPort: IAgentListPort = {
  async getLayout() {
    const agents = await apiAgentPort.listAgents();
    return buildDefaultLayout(agents);
  },

  async getRuntimeByAgentId() {
    const [agents, runs] = await Promise.all([apiAgentPort.listAgents(), listRecentRuns()]);
    return buildRuntimeMap(runs.items, agents.map((agent) => agent.id));
  },

  async finishAgentListInit() {
    await Promise.resolve();
  },
};
