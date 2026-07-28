import { create } from 'zustand';

import { getEnabledChatModels } from '../adapters/modelAdapter';
import type { Agent, AgentChatConfig, AgentConfigPatch, AgentPlusState } from '../domain/types';
import { mapProviderTypeToFamily } from '../hooks/useProviderFamily';
import { writeStoredActiveAgentId } from '../services/agent/activeAgentStorage';
import { getAgentConsolePorts, isAgentConsoleApiMode } from '../adapters/registry';
import { deriveAgentBindingIds } from '../domain/utils/agentPluginBindings';
import type { CreateAgentInput } from '../adapters/ports/IAgentPort';
import type { AgentConsoleSnapshot } from '../adapters/types';
import { refreshAgentList } from '../hooks/data/invalidate';
import {
  createDefaultPlusState,
  FALLBACK_PLUS_STATE,
} from '../domain/defaults/agentPlusState';
import {
  clearCategoryBinding,
} from '../utils/agentConsoleToolBindings';
import {
  applyAdminExclusiveBindings,
  canToggleAdminExclusiveTool,
} from '../domain/utils/adminExclusiveBindings';
import { useWorkspaceStore } from './workspaceStore';

async function persistAgentPlusState(agentId: string, nextPlus: AgentPlusState): Promise<void> {
  const catalog = useWorkspaceStore.getState().skillCatalog;
  const normalized = applyAdminExclusiveBindings(agentId, nextPlus);
  const { toolIds, skillIds, mcpServerIds } = deriveAgentBindingIds(normalized.plugins, catalog);
  await getAgentConsolePorts().agent.updateAgentConfig(agentId, {
    toolIds,
    skillIds,
    mcpServerIds,
    ...nextPlus.categoryBindings,
  });
}

const BINDING_PERSIST_DEBOUNCE_MS = 400;
const bindingPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const bindingPersistWaiters = new Map<string, Array<{ reject: (error: unknown) => void; resolve: () => void }>>();

function scheduleBindingPersist(
  agentId: string,
  readPlusState: () => AgentPlusState | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const waiters = bindingPersistWaiters.get(agentId) ?? [];
    waiters.push({ resolve, reject });
    bindingPersistWaiters.set(agentId, waiters);

    const existingTimer = bindingPersistTimers.get(agentId);
    if (existingTimer) clearTimeout(existingTimer);

    bindingPersistTimers.set(
      agentId,
      setTimeout(() => {
        bindingPersistTimers.delete(agentId);
        const pending = bindingPersistWaiters.get(agentId) ?? [];
        bindingPersistWaiters.delete(agentId);
        const snapshot = readPlusState();
        if (!snapshot) {
          pending.forEach((w) => w.resolve());
          return;
        }
        void persistAgentPlusState(agentId, snapshot)
          .then(() => pending.forEach((w) => w.resolve()))
          .catch((error) => pending.forEach((w) => w.reject(error)));
      }, BINDING_PERSIST_DEBOUNCE_MS),
    );
  });
}

interface AgentState {
  /** @deprecated server list — prefer `useAgents()`; kept for bootstrap + optimistic UI */
  agents: Agent[];
  activeAgentId: string;
  plusStateByAgentId: Record<string, AgentPlusState>;
  isConfigLoading: boolean;
  configError: string | null;
  setActiveAgentId: (id: string) => void;
  getActiveAgent: () => Agent;
  getActivePlusState: () => AgentPlusState;
  getChatConfig: () => AgentChatConfig;
  isAgentModeEnabled: () => boolean;
  getEnableAgentMode: () => boolean;
  isLocalSystemEnabled: () => boolean;
  getEffectiveWorkingDirectory: (topicWorkingDirectory?: string) => string;
  updateAgentChatConfig: (patch: Partial<AgentChatConfig>) => Promise<void>;
  updateAgentConfig: (patch: AgentConfigPatch) => Promise<void>;
  /** Agent 级默认模型（助手档案）；会话内切换模型请用 topicStore.setTopicModelProvider。 */
  setActiveModelProvider: (model: string, provider: string) => void;
  toggleFile: (fileId: string, enabled: boolean) => void;
  toggleKnowledgeBase: (kbId: string, enabled: boolean) => void;
  togglePlugin: (pluginId: string, enabled?: boolean) => void;
  commitAgentBindings: (updater: (prev: AgentPlusState) => AgentPlusState) => Promise<void>;
  setPluginPinned: (pluginId: string, pinned: boolean) => void;
  uninstallPlugin: (pluginId: string) => void;
  setSkillActivateMode: (mode: AgentChatConfig['skillActivateMode']) => void;
  hydrate: (snapshot: Pick<AgentConsoleSnapshot, 'agents' | 'activeAgentId' | 'plusStateByAgentId'>) => void;
  finishConfigLoad: () => void;
  retryAgentConfigFetch: () => Promise<void>;
  renameAgent: (agentId: string, name: string) => Promise<void>;
  removeAgentFromCatalog: (agentId: string) => Promise<void>;
  duplicateAgentInCatalog: (agentId: string) => Promise<string | null>;
  createAgentInCatalog: (input?: CreateAgentInput) => Promise<string | null>;
}

const AGENT_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
  'linear-gradient(135deg, #10b981, #0ea5e9)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
] as const;

const FALLBACK_AGENT: Agent = {
  id: '',
  name: '智能体',
  description: '',
  gradient: AGENT_GRADIENTS[0],
  openingQuestions: [],
};

function configErrorForAgent(_agentId: string): string | null {
  return null;
}

function sourceGradientForNewAgent(agentId: string): string {
  let hash = 0;
  for (const char of agentId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AGENT_GRADIENTS[hash % AGENT_GRADIENTS.length];
}

function patchPlusStateForAgent(
  map: Record<string, AgentPlusState>,
  agentId: string,
  patch: (prev: AgentPlusState) => AgentPlusState,
): Record<string, AgentPlusState> {
  const prev = map[agentId] ?? createDefaultPlusState();
  return { ...map, [agentId]: patch(prev) };
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  activeAgentId: FALLBACK_AGENT.id,
  plusStateByAgentId: {},
  isConfigLoading: true,
  configError: null,

  setActiveAgentId: (id) => {
    const error = configErrorForAgent(id);
    if (isAgentConsoleApiMode()) {
      writeStoredActiveAgentId(id);
    }
    set({
      activeAgentId: id,
      isConfigLoading: false,
      configError: isAgentConsoleApiMode() ? null : error,
    });
  },

  getActiveAgent: () => {
    const { agents, activeAgentId } = get();
    return agents.find((a) => a.id === activeAgentId) ?? agents[0] ?? FALLBACK_AGENT;
  },

  getActivePlusState: () => {
    const { activeAgentId, plusStateByAgentId } = get();
    const map = plusStateByAgentId ?? {};
    return map[activeAgentId] ?? FALLBACK_PLUS_STATE;
  },

  getChatConfig: () => get().getActivePlusState().chatConfig,

  isAgentModeEnabled: () => true,

  getEnableAgentMode: () => get().getChatConfig().enableAgentMode !== false,

  isLocalSystemEnabled: () => Boolean(get().getActiveAgent().isLocalSystemEnabled),

  getEffectiveWorkingDirectory: (topicWorkingDirectory) => {
    const agent = get().getActiveAgent();
    return topicWorkingDirectory || agent.workingDirectory || '';
  },

  updateAgentChatConfig: (patch) => get().updateAgentConfig({ chatConfig: patch }),

  updateAgentConfig: async (patch) => {
    const agentId = get().activeAgentId;
    set((s) => ({
      plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, (prev) => ({
        ...prev,
        model: patch.model ?? prev.model,
        provider: patch.provider ?? prev.provider,
        chatConfig: patch.chatConfig
          ? {
              ...prev.chatConfig,
              ...patch.chatConfig,
              memory: patch.chatConfig.memory
                ? { ...prev.chatConfig.memory, ...patch.chatConfig.memory }
                : prev.chatConfig.memory,
            }
          : prev.chatConfig,
        params: patch.params ? { ...prev.params, ...patch.params } : prev.params,
        systemRole: patch.systemRole ?? prev.systemRole,
        structuredSystemRole:
          patch.structuredSystemRole === null
            ? undefined
            : (patch.structuredSystemRole ?? prev.structuredSystemRole),
      })),
    }));
    await getAgentConsolePorts().agent.updateAgentConfig(agentId, patch);
  },

  setActiveModelProvider: (model, provider) => {
    const state = get();
    const prev = state.plusStateByAgentId[state.activeAgentId];
    const catalog = getEnabledChatModels();
    const entry = catalog.find((p) => p.id === provider);
    const family = mapProviderTypeToFamily(entry?.providerType, provider);
    const patch: AgentConfigPatch = { model, provider };
    if (family !== 'google' && prev?.chatConfig.useModelBuiltinSearch) {
      patch.chatConfig = { useModelBuiltinSearch: false };
    }
    get().updateAgentConfig(patch);
  },

  toggleFile: (fileId, enabled) => {
    const agentId = get().activeAgentId;
    set((s) => ({
      plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, (prev) => ({
        ...prev,
        files: prev.files.map((f) => (f.id === fileId ? { ...f, enabled } : f)),
      })),
    }));
    void (async () => {
      try {
        const workspace = getAgentConsolePorts().workspace;
        if (enabled) await workspace.bindFile(agentId, fileId);
        else await workspace.unbindFile(agentId, fileId);
      } catch {
        set((s) => ({
          plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, (prev) => ({
            ...prev,
            files: prev.files.map((f) => (f.id === fileId ? { ...f, enabled: !enabled } : f)),
          })),
        }));
        const { showToast } = await import('../services/ui/toast');
        showToast('文件绑定失败，请重试');
      }
    })();
  },

  toggleKnowledgeBase: (kbId, enabled) => {
    const agentId = get().activeAgentId;
    set((s) => ({
      plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, (prev) => ({
        ...prev,
        knowledgeBases: prev.knowledgeBases.map((kb) =>
          kb.id === kbId ? { ...kb, enabled } : kb,
        ),
      })),
    }));
    void (async () => {
      try {
        const workspace = getAgentConsolePorts().workspace;
        if (enabled) await workspace.bindKnowledgeBase(agentId, kbId);
        else await workspace.unbindKnowledgeBase(agentId, kbId);
      } catch {
        set((s) => ({
          plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, (prev) => ({
            ...prev,
            knowledgeBases: prev.knowledgeBases.map((kb) =>
              kb.id === kbId ? { ...kb, enabled: !enabled } : kb,
            ),
          })),
        }));
        const { showToast } = await import('../services/ui/toast');
        showToast('知识库绑定失败，请重试');
      }
    })();
  },

  togglePlugin: (pluginId, enabled) => {
    const agentId = get().activeAgentId;
    if (!canToggleAdminExclusiveTool(agentId, pluginId)) {
      return;
    }
    void get().commitAgentBindings((prev) => {
      const previousEnabled = prev.plugins[pluginId] ?? false;
      const nextEnabled = enabled ?? !previousEnabled;
      let next: AgentPlusState = {
        ...prev,
        plugins: { ...prev.plugins, [pluginId]: nextEnabled },
      };
      if (!nextEnabled) {
        next = clearCategoryBinding(next, pluginId);
      }
      return next;
    });
  },

  commitAgentBindings: async (updater) => {
    const agentId = get().activeAgentId;
    const previous = get().plusStateByAgentId[agentId] ?? createDefaultPlusState();
    const nextPlus = applyAdminExclusiveBindings(agentId, updater(previous));

    set((s) => ({
      plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, () => nextPlus),
    }));

    if (!isAgentConsoleApiMode()) return;

    try {
      await scheduleBindingPersist(agentId, () => get().plusStateByAgentId[agentId]);
    } catch (error) {
      try {
        const fresh = await getAgentConsolePorts().agent.getPlusState(agentId);
        set((s) => ({
          plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, () => fresh),
        }));
      } catch {
        set((s) => ({
          plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, () => previous),
        }));
      }
      const { showErrorToast } = await import('../services/ui/toast');
      const message = error instanceof Error ? error.message : '工具/技能绑定失败，请重试';
      showErrorToast(message.includes('绑定') ? message : `工具/技能绑定失败：${message}`);
    }
  },

  setPluginPinned: (pluginId, pinned) => {
    const agentId = get().activeAgentId;
    set((s) => ({
      plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, (prev) => ({
        ...prev,
        pinnedPlugins: { ...prev.pinnedPlugins, [pluginId]: pinned },
      })),
    }));
  },

  setSkillActivateMode: (mode) => {
    get().updateAgentChatConfig({ skillActivateMode: mode });
  },

  uninstallPlugin: (pluginId) => {
    const agentId = get().activeAgentId;
    useWorkspaceStore.getState().removeSkillFromCatalog(pluginId);
    set((s) => ({
      plusStateByAgentId: patchPlusStateForAgent(s.plusStateByAgentId, agentId, (prev) => {
        const { [pluginId]: _removed, ...plugins } = prev.plugins;
        const { [pluginId]: _pinned, ...pinnedPlugins } = prev.pinnedPlugins;
        return { ...prev, plugins, pinnedPlugins };
      }),
    }));
  },

  hydrate: (snapshot) =>
    set((state) => {
      const plusStateByAgentId = Object.fromEntries(
        Object.entries(snapshot.plusStateByAgentId ?? state.plusStateByAgentId ?? {}).map(
          ([agentId, plusState]) => [agentId, applyAdminExclusiveBindings(agentId, plusState)],
        ),
      );
      return {
        agents: snapshot.agents,
        activeAgentId: snapshot.activeAgentId,
        plusStateByAgentId,
        isConfigLoading: isAgentConsoleApiMode() ? false : true,
        configError: isAgentConsoleApiMode() ? null : configErrorForAgent(snapshot.activeAgentId),
      };
    }),

  finishConfigLoad: () => {
    const { configError } = get();
    if (configError) return;
    set({ isConfigLoading: false });
  },

  retryAgentConfigFetch: async () => {
    set({ isConfigLoading: true, configError: null });
    await new Promise((r) => window.setTimeout(r, 400));
    set({ isConfigLoading: false, configError: null });
  },

  renameAgent: async (agentId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      agents: s.agents.map((a) => (a.id === agentId ? { ...a, name: trimmed } : a)),
    }));
    await getAgentConsolePorts().agent.renameAgent(agentId, trimmed);
    await refreshAgentList();
  },

  removeAgentFromCatalog: async (agentId) => {
    if (agentId === FALLBACK_AGENT.id) return;
    set((s) => {
      const agents = s.agents.filter((a) => a.id !== agentId);
      const activeAgentId =
        s.activeAgentId === agentId
          ? agents[0]?.id ?? FALLBACK_AGENT.id
          : s.activeAgentId;
      return { agents, activeAgentId };
    });
    await getAgentConsolePorts().agent.removeAgent(agentId);
    await refreshAgentList();
  },

  duplicateAgentInCatalog: async (agentId) => {
    const source = get().agents.find((a) => a.id === agentId);
    if (!source) return null;
    const newId = await getAgentConsolePorts().agent.duplicateAgent(agentId);
    if (!newId) return null;
    const copy: Agent = { ...source, id: newId, name: `${source.name} 副本` };
    set((s) => ({ agents: [...s.agents, copy] }));
    await refreshAgentList();
    return newId;
  },

  createAgentInCatalog: async (input) => {
    const newId = await getAgentConsolePorts().agent.createAgent(input);
    if (!newId) return null;

    const name =
      input?.name ?? (input?.sessionType === 'group' ? '新群聊' : '新 Agent');

    const newAgent: Agent = {
      id: newId,
      name,
      description: '',
      gradient: sourceGradientForNewAgent(newId),
      sessionType: input?.sessionType === 'group' ? 'group' : undefined,
    };

    set((s) => ({ agents: [...s.agents, newAgent] }));
    await refreshAgentList();
    get().setActiveAgentId(newId);
    return newId;
  },
}));
