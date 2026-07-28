import { create } from 'zustand';

import {
  DEFAULT_AGENCY_CONFIG,
  createDefaultGitStatus,
} from '../domain/defaults/workspaceControls';
import type {
  AgencyConfig,
  DeviceExecutionTarget,
  GitBranchInfo,
  GitRepoStatus,
  RecentWorkingDir,
  WorkspaceDevice,
} from '../domain/types/workspaceControls';
import type { AgentSandboxStatusDto } from '../domain/types/sandbox';
import { AgentConsoleApiError } from '../adapters/api/http';
import { getAgentConsolePorts } from '../adapters/registry';
import { useWorkspaceStore } from './workspaceStore';

const SANDBOX_STATUS_POLL_MS = 15_000;
const sandboxStatusPollers = new Map<string, ReturnType<typeof setInterval>>();

export type WorkspaceControlsHydrateSeed = {
  devices: WorkspaceDevice[];
  recentDirs: RecentWorkingDir[];
  branches: GitBranchInfo[];
  cloudRepos: string[];
  gitStatus: GitRepoStatus;
};

interface WorkspaceControlsState {
  devices: WorkspaceDevice[];
  recentDirs: RecentWorkingDir[];
  agencyByAgentId: Record<string, AgencyConfig>;
  sandboxStatusByAgentId: Record<string, AgentSandboxStatusDto | undefined>;
  sandboxLoadingByAgentId: Record<string, boolean>;
  gitStatus: GitRepoStatus;
  branches: GitBranchInfo[];
  cloudRepos: string[];
  selectedReposByTopicId: Record<string, string[]>;
  pendingTopicRepos: string[];
  pulling: boolean;
  pushing: boolean;

  getAgencyConfig: (agentId: string) => AgencyConfig;
  hydrateAgencyConfigs: (configs: Record<string, AgencyConfig>) => void;
  hydrateWorkspaceControls: (seed: WorkspaceControlsHydrateSeed) => void;
  fetchSandboxStatus: (agentId: string) => Promise<AgentSandboxStatusDto | undefined>;
  startSandboxStatusPolling: (agentId: string) => void;
  stopSandboxStatusPolling: (agentId: string) => void;
  startSandbox: (agentId: string) => Promise<AgentSandboxStatusDto | undefined>;
  stopSandbox: (agentId: string) => Promise<AgentSandboxStatusDto | undefined>;
  setExecutionTarget: (
    agentId: string,
    target: DeviceExecutionTarget,
    boundDeviceId?: string,
  ) => void;
  commitWorkingDirectory: (path: string) => void;
  clearTopicWorkingDirectory: (topicId: string) => void;
  removeRecentDir: (path: string) => void;
  removeDeviceWorkingDir: (agentId: string, deviceId: string, path: string) => void;
  getPendingTopicRepos: () => string[];
  setPendingTopicRepos: (repos: string[]) => void;
  consumePendingTopicRepos: () => string[];
  validateWorkingDirPath: (path: string) => Promise<string | undefined>;
  refreshBranches: () => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  renameBranch: (from: string, to: string) => Promise<void>;
  deleteBranch: (name: string) => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  toggleCloudRepo: (topicId: string, repo: string) => void;
}

export const useWorkspaceControlsStore = create<WorkspaceControlsState>((set, get) => ({
  devices: [],
  recentDirs: [],
  agencyByAgentId: {},
  sandboxStatusByAgentId: {},
  sandboxLoadingByAgentId: {},
  gitStatus: createDefaultGitStatus(0),
  branches: [],
  cloudRepos: [],
  selectedReposByTopicId: {},
  pendingTopicRepos: [],
  pulling: false,
  pushing: false,

  getAgencyConfig: (agentId) => get().agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG,

  hydrateAgencyConfigs: (configs) =>
    set((s) => ({
      agencyByAgentId: {
        ...s.agencyByAgentId,
        ...configs,
      },
    })),

  hydrateWorkspaceControls: (seed) =>
    set({
      devices: seed.devices,
      recentDirs: seed.recentDirs,
      branches: seed.branches,
      cloudRepos: seed.cloudRepos,
      gitStatus: seed.gitStatus,
    }),

  fetchSandboxStatus: async (agentId) => {
    set((s) => ({
      sandboxLoadingByAgentId: { ...s.sandboxLoadingByAgentId, [agentId]: true },
    }));
    try {
      const status = await getAgentConsolePorts().sandbox.getSandboxStatus(agentId);
      set((s) => ({
        sandboxStatusByAgentId: { ...s.sandboxStatusByAgentId, [agentId]: status },
      }));
      return status;
    } catch {
      return get().sandboxStatusByAgentId[agentId];
    } finally {
      set((s) => ({
        sandboxLoadingByAgentId: { ...s.sandboxLoadingByAgentId, [agentId]: false },
      }));
    }
  },

  startSandboxStatusPolling: (agentId) => {
    get().stopSandboxStatusPolling(agentId);
    void get().fetchSandboxStatus(agentId);
    const timer = setInterval(() => {
      void get().fetchSandboxStatus(agentId);
    }, SANDBOX_STATUS_POLL_MS);
    sandboxStatusPollers.set(agentId, timer);
  },

  stopSandboxStatusPolling: (agentId) => {
    const timer = sandboxStatusPollers.get(agentId);
    if (timer) {
      clearInterval(timer);
      sandboxStatusPollers.delete(agentId);
    }
  },

  startSandbox: async (agentId) => {
    set((s) => ({
      sandboxLoadingByAgentId: { ...s.sandboxLoadingByAgentId, [agentId]: true },
    }));
    try {
      const status = await getAgentConsolePorts().sandbox.startSandbox(agentId);
      set((s) => ({
        sandboxStatusByAgentId: { ...s.sandboxStatusByAgentId, [agentId]: status },
      }));
      return status;
    } catch (error) {
      const { showToast } = await import('../services/ui/toast');
      const message =
        error instanceof AgentConsoleApiError ? error.message : '沙箱启动失败，请稍后重试';
      showToast(message);
      return get().sandboxStatusByAgentId[agentId];
    } finally {
      set((s) => ({
        sandboxLoadingByAgentId: { ...s.sandboxLoadingByAgentId, [agentId]: false },
      }));
    }
  },

  stopSandbox: async (agentId) => {
    set((s) => ({
      sandboxLoadingByAgentId: { ...s.sandboxLoadingByAgentId, [agentId]: true },
    }));
    try {
      const status = await getAgentConsolePorts().sandbox.stopSandbox(agentId);
      set((s) => ({
        sandboxStatusByAgentId: { ...s.sandboxStatusByAgentId, [agentId]: status },
      }));
      return status;
    } finally {
      set((s) => ({
        sandboxLoadingByAgentId: { ...s.sandboxLoadingByAgentId, [agentId]: false },
      }));
    }
  },

  setExecutionTarget: (agentId, target, boundDeviceId) =>
    set((s) => {
      const prev = s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG;
      return {
        agencyByAgentId: {
          ...s.agencyByAgentId,
          [agentId]: {
            ...prev,
            executionTarget: target,
            boundDeviceId: boundDeviceId ?? undefined,
          },
        },
      };
    }),

  commitWorkingDirectory: (path) => {
    const name = path.split('/').filter(Boolean).pop() ?? path;
    set((s) => {
      const filtered = s.recentDirs.filter((d) => d.path !== path);
      return {
        recentDirs: [{ path, name }, ...filtered].slice(0, 8),
      };
    });
    useWorkspaceStore.setState({ workingDir: path });
  },

  clearTopicWorkingDirectory: () => {
    // topic override cleared via topicStore in picker hook
  },

  removeRecentDir: (path) =>
    set((s) => ({
      recentDirs: s.recentDirs.filter((d) => d.path !== path),
    })),

  removeDeviceWorkingDir: (agentId, deviceId, path) =>
    set((s) => {
      const prev = s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG;
      const nextDirs = { ...prev.workingDirByDevice };
      if (nextDirs[deviceId] === path) delete nextDirs[deviceId];
      return {
        recentDirs: s.recentDirs.filter((d) => d.path !== path),
        agencyByAgentId: {
          ...s.agencyByAgentId,
          [agentId]: { ...prev, workingDirByDevice: nextDirs },
        },
      };
    }),

  getPendingTopicRepos: () => get().pendingTopicRepos,

  setPendingTopicRepos: (repos) => set({ pendingTopicRepos: repos }),

  consumePendingTopicRepos: () => {
    const repos = get().pendingTopicRepos;
    set({ pendingTopicRepos: [] });
    return repos;
  },

  validateWorkingDirPath: async (path) => {
    await new Promise((r) => setTimeout(r, 200));
    const trimmed = path.trim();
    if (!trimmed) return '路径不能为空';
    if (!trimmed.startsWith('/') && !trimmed.startsWith('~')) {
      return '请输入绝对路径';
    }
    if (trimmed.includes('..')) return '路径无效';
    return undefined;
  },

  refreshBranches: async () => {
    await new Promise((r) => setTimeout(r, 400));
  },

  checkoutBranch: async (name) => {
    await new Promise((r) => setTimeout(r, 300));
    set((s) => ({
      gitStatus: { ...s.gitStatus, branch: name },
      branches: s.branches.map((b) => ({
        ...b,
        current: b.name === name,
      })),
    }));
  },

  createBranch: async (name) => {
    await new Promise((r) => setTimeout(r, 300));
    set((s) => ({
      branches: [...s.branches, { name, current: true, hasUncommitted: false }],
      gitStatus: { ...s.gitStatus, branch: name },
    }));
  },

  renameBranch: async (from, to) => {
    await new Promise((r) => setTimeout(r, 300));
    set((s) => ({
      branches: s.branches.map((b) => (b.name === from ? { ...b, name: to } : b)),
      gitStatus:
        s.gitStatus.branch === from ? { ...s.gitStatus, branch: to } : s.gitStatus,
    }));
  },

  deleteBranch: async (name) => {
    await new Promise((r) => setTimeout(r, 300));
    set((s) => ({
      branches: s.branches.filter((b) => b.name !== name),
    }));
  },

  pull: async () => {
    set({ pulling: true });
    await new Promise((r) => setTimeout(r, 600));
    set((s) => ({
      pulling: false,
      gitStatus: { ...s.gitStatus, behind: 0 },
    }));
  },

  push: async () => {
    set({ pushing: true });
    await new Promise((r) => setTimeout(r, 600));
    set((s) => ({
      pushing: false,
      gitStatus: { ...s.gitStatus, ahead: 0 },
    }));
  },

  toggleCloudRepo: (topicId, repo) =>
    set((s) => {
      const current = s.selectedReposByTopicId[topicId] ?? [];
      const next = current.includes(repo)
        ? current.filter((r) => r !== repo)
        : [...current, repo];
      return {
        selectedReposByTopicId: { ...s.selectedReposByTopicId, [topicId]: next },
      };
    }),
}));
