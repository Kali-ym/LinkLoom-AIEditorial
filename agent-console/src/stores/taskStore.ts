import { create } from 'zustand';

import { getAgentConsolePorts } from '../adapters/registry';
import type { AgentConsoleSnapshot } from '../adapters/types';
import type { SidebarTask, TaskGroup, TaskGroupKey } from '../domain/types/task';

const STATUS_ORDER: TaskGroupKey[] = ['needsInput', 'backlog', 'running'];

/** Pure ordering — use with `taskGroups` slice + useMemo. */
export function orderTaskGroups(taskGroups: TaskGroup[]): TaskGroup[] {
  const map = new Map(taskGroups.map((g) => [g.key, g]));
  return STATUS_ORDER.map((key) => map.get(key)).filter(
    (g): g is TaskGroup => !!g && g.tasks.length > 0,
  );
}

interface TaskState {
  /** @deprecated server list — prefer `useTaskGroups()`; kept for bootstrap + selection UI */
  taskGroups: TaskGroup[];
  activeTaskId: string;
  routeTaskId: string;
  isLoading: boolean;

  hydrate: (snapshot: Pick<AgentConsoleSnapshot, 'taskGroups'>) => void;
  reloadForAgent: (agentId: string) => Promise<void>;
  getOrderedGroups: () => TaskGroup[];
  getTotalTaskCount: () => number;
  selectTask: (taskId: string) => void;
  setRouteTaskId: (routeTaskId: string) => void;
  getTaskById: (taskId: string) => SidebarTask | undefined;
  findTaskByRouteId: (routeTaskId: string) => SidebarTask | undefined;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  taskGroups: [],
  activeTaskId: '',
  routeTaskId: '',
  isLoading: true,

  hydrate: (snapshot) => {
    set({
      taskGroups: snapshot.taskGroups,
      isLoading: false,
    });
  },

  reloadForAgent: async (agentId) => {
    set({ isLoading: true });
    try {
      const taskGroups = await getAgentConsolePorts().task.fetchTaskGroups(agentId);
      set({ taskGroups, isLoading: false });
    } catch {
      set({ taskGroups: [], isLoading: false });
    }
  },

  getOrderedGroups: () => orderTaskGroups(get().taskGroups),

  getTotalTaskCount: () =>
    orderTaskGroups(get().taskGroups).reduce((acc, g) => acc + g.tasks.length, 0),

  selectTask: (taskId) => set({ activeTaskId: taskId }),

  setRouteTaskId: (routeTaskId) => set({ routeTaskId }),

  getTaskById: (taskId) => {
    for (const group of get().taskGroups) {
      const task = group.tasks.find((t) => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  },

  findTaskByRouteId: (routeTaskId) => {
    if (!routeTaskId) return undefined;
    for (const group of get().taskGroups) {
      const task = group.tasks.find(
        (t) => t.id === routeTaskId || t.identifier === routeTaskId,
      );
      if (task) return task;
    }
    return undefined;
  },
}));
