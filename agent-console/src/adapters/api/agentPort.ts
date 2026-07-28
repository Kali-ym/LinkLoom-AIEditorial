import { filterAgentsForConsole } from '../../domain/consoleAgentFilter';
import type { AgentPlusState } from '../../domain/types';
import type { IAgentPort } from '../ports/IAgentPort';
import {
  clearStoredActiveAgentId,
  readStoredActiveAgentId,
  writeStoredActiveAgentId,
} from './activeAgentStorage';
import {
  agentConsoleDeleteJson,
  agentConsoleGetJson,
  agentConsolePostJson,
} from './http';
import type { CreateAgentInput } from '../ports/IAgentPort';
import {
  applyConfigPatchToBackendAgent,
  cloneBackendAgentAsDuplicate,
  createBlankBackendAgent,
  mapBackendAgentToDomain,
  mapBackendAgentToPlusState,
  readAgencyConfigFromBackendAgent,
} from './mappers/agent';
import {
  mergeBindingsIntoPlusState,
  type BackendBindingsListDto,
  type KbCategoryNameDto,
} from './mappers/agentBindings';
import type { KbCategoryDto } from './mappers/kbDocuments';
import type { BackendAgentDto } from './types/agent';
import { applyAdminExclusiveBindings } from '../../domain/utils/adminExclusiveBindings';
import { useWorkspaceControlsStore } from '../../stores/workspaceControlsStore';
import { DEFAULT_AGENCY_CONFIG } from '../../domain/defaults/workspaceControls';

async function fetchKbCategoryNames(): Promise<KbCategoryNameDto[]> {
  try {
    const categories = await agentConsoleGetJson<KbCategoryDto[]>('/api/kb/categories');
    return categories.map((category) => ({ id: category.id, name: category.name }));
  } catch {
    return [];
  }
}

async function fetchAgentBindings(agentId: string) {
  const result = await agentConsoleGetJson<BackendBindingsListDto>(
    `/api/agents/${encodeURIComponent(agentId)}/bindings`,
  );
  return result.bindings;
}

async function hydratePlusState(
  agent: BackendAgentDto,
  kbCategories: KbCategoryNameDto[],
): Promise<AgentPlusState> {
  const base = mapBackendAgentToPlusState(agent);
  const bindings = await fetchAgentBindings(agent.id);
  return applyAdminExclusiveBindings(
    agent.id,
    mergeBindingsIntoPlusState(base, bindings, kbCategories),
  );
}

async function hydrateAgencyConfigsFromAgents(agents: BackendAgentDto[]): Promise<void> {
  const configs = Object.fromEntries(
    agents
      .map((agent) => {
        const agency = readAgencyConfigFromBackendAgent(agent);
        return agency ? ([agent.id, { ...DEFAULT_AGENCY_CONFIG, ...agency }] as const) : null;
      })
      .filter((entry): entry is readonly [string, typeof DEFAULT_AGENCY_CONFIG] => entry !== null),
  );
  if (Object.keys(configs).length > 0) {
    useWorkspaceControlsStore.getState().hydrateAgencyConfigs(configs);
  }
}

async function fetchBackendAgents(): Promise<BackendAgentDto[]> {
  const agents = await agentConsoleGetJson<BackendAgentDto[]>('/api/agents');
  await hydrateAgencyConfigsFromAgents(agents);
  return agents;
}

async function fetchBackendAgent(agentId: string): Promise<BackendAgentDto | null> {
  try {
    return await agentConsoleGetJson<BackendAgentDto>(
      `/api/agents/${encodeURIComponent(agentId)}`,
    );
  } catch {
    const agents = await fetchBackendAgents();
    return agents.find((agent) => agent.id === agentId) ?? null;
  }
}

async function saveBackendAgent(agent: BackendAgentDto): Promise<void> {
  await agentConsolePostJson('/api/agents', agent);
}

function resolveActiveAgentId(agents: BackendAgentDto[]): string {
  const visible = filterAgentsForConsole(agents.map(mapBackendAgentToDomain));
  const visibleIds = new Set(visible.map((agent) => agent.id));
  const stored = readStoredActiveAgentId();
  if (stored && visibleIds.has(stored)) {
    return stored;
  }
  const first = visible[0]?.id ?? agents.find((agent) => !agent.isHidden)?.id;
  if (!first) {
    throw new Error('No visible agents returned from /api/agents');
  }
  writeStoredActiveAgentId(first);
  return first;
}

export const apiAgentPort: IAgentPort = {
  async listAgents() {
    const agents = await fetchBackendAgents();
    return filterAgentsForConsole(agents.map(mapBackendAgentToDomain));
  },

  async getAgent(agentId) {
    const agent = await fetchBackendAgent(agentId);
    return agent ? mapBackendAgentToDomain(agent) : null;
  },

  async getActiveAgentId() {
    const agents = await fetchBackendAgents();
    return resolveActiveAgentId(agents);
  },

  async getPlusState(agentId) {
    const agent = await fetchBackendAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    const kbCategories = await fetchKbCategoryNames();
    return hydratePlusState(agent, kbCategories);
  },

  async getPlusStateMap() {
    const agents = await fetchBackendAgents();
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    const visible = filterAgentsForConsole(agents.map(mapBackendAgentToDomain));
    const kbCategories = await fetchKbCategoryNames();
    const entries = await Promise.all(
      visible.map(async (agent): Promise<[string, AgentPlusState]> => [
        agent.id,
        await hydratePlusState(byId.get(agent.id)!, kbCategories),
      ]),
    );
    return Object.fromEntries(entries);
  },

  async updateAgentConfig(agentId, patch) {
    const current = await fetchBackendAgent(agentId);
    if (!current) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    await saveBackendAgent(applyConfigPatchToBackendAgent(current, patch));
  },

  async renameAgent(agentId, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = await fetchBackendAgent(agentId);
    if (!current) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    await saveBackendAgent({ ...current, name: trimmed });
  },

  async removeAgent(agentId) {
    await agentConsoleDeleteJson(`/api/agents/${encodeURIComponent(agentId)}`);
    const stored = readStoredActiveAgentId();
    if (stored === agentId) {
      clearStoredActiveAgentId();
    }
  },

  async duplicateAgent(agentId) {
    const source = await fetchBackendAgent(agentId);
    if (!source) return null;
    const newId = `${agentId}-copy-${Date.now()}`;
    const duplicate = cloneBackendAgentAsDuplicate(source, newId, `${source.name} 副本`);
    await saveBackendAgent(duplicate);
    return newId;
  },

  async createAgent(input?: CreateAgentInput) {
    const agent = createBlankBackendAgent({
      name: input?.name,
      sessionType: input?.sessionType,
    });
    await saveBackendAgent(agent);
    writeStoredActiveAgentId(agent.id);
    return agent.id;
  },

  async installSkill(agentId, skillId) {
    const current = await fetchBackendAgent(agentId);
    if (!current) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    const skillIds = [...new Set([...(current.skillIds ?? []), skillId])];
    await saveBackendAgent({ ...current, skillIds });
  },
};
