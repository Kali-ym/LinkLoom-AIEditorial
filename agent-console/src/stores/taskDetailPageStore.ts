import { create } from 'zustand';

import { getAgentConsolePorts } from '../adapters/registry';
import type { TaskDetailArtifact, TaskDetailPageData } from '../domain/types/taskDetailPage';
import type { TaskStatus } from '../domain/types/task';
import { useTaskStore } from './taskStore';

interface TaskDetailPageState {
  taskId: string | null;
  detail: TaskDetailPageData | null;
  isLoading: boolean;
  isNotFound: boolean;
  chatDrawerOpen: boolean;
  previewArtifact: TaskDetailArtifact | null;

  load: (routeTaskId: string) => Promise<void>;
  reset: () => void;
  updateTitle: (title: string) => void;
  setRunStatus: (status: TaskStatus) => void;
  toggleSubtask: (subtaskId: string) => void;
  updateSubtaskTitle: (subtaskId: string, title: string) => void;
  setChatDrawerOpen: (open: boolean) => void;
  openArtifactPreview: (artifact: TaskDetailArtifact) => void;
  closeArtifactPreview: () => void;
}

/** §C.54 — `/task/:taskId` page bucket */
export const useTaskDetailPageStore = create<TaskDetailPageState>((set, get) => ({
  taskId: null,
  detail: null,
  isLoading: false,
  isNotFound: false,
  chatDrawerOpen: false,
  previewArtifact: null,

  load: async (routeTaskId) => {
    set({
      taskId: routeTaskId,
      isLoading: true,
      isNotFound: false,
      detail: null,
      chatDrawerOpen: false,
      previewArtifact: null,
    });
    const sidebarTask =
      useTaskStore.getState().findTaskByRouteId(routeTaskId) ??
      (routeTaskId.startsWith('run_')
        ? {
            id: routeTaskId,
            identifier: routeTaskId.slice(0, 16),
            status: 'running' as const,
          }
        : undefined);
    const detail = await getAgentConsolePorts().task.fetchTaskDetail(sidebarTask);
    set({
      detail,
      isLoading: false,
      isNotFound: !detail,
    });
  },

  reset: () =>
    set({
      taskId: null,
      detail: null,
      isLoading: false,
      isNotFound: false,
      chatDrawerOpen: false,
      previewArtifact: null,
    }),

  updateTitle: (title) => {
    const detail = get().detail;
    const taskId = get().taskId;
    if (!detail || !taskId) return;
    set({ detail: { ...detail, title } });
    void getAgentConsolePorts().task.saveTaskDetail(taskId, { title });
  },

  setRunStatus: (status) => {
    const detail = get().detail;
    const taskId = get().taskId;
    if (!detail || !taskId) return;
    set({ detail: { ...detail, status } });
    void getAgentConsolePorts().task.saveTaskDetail(taskId, { status });
  },

  toggleSubtask: (subtaskId) => {
    const detail = get().detail;
    const taskId = get().taskId;
    if (!detail || !taskId) return;
    const subtasks = detail.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s,
    );
    set({ detail: { ...detail, subtasks } });
    void getAgentConsolePorts().task.saveTaskDetail(taskId, { subtasks });
  },

  updateSubtaskTitle: (subtaskId, title) => {
    const detail = get().detail;
    const taskId = get().taskId;
    if (!detail || !taskId) return;
    const subtasks = detail.subtasks.map((s) => (s.id === subtaskId ? { ...s, title } : s));
    set({ detail: { ...detail, subtasks } });
    void getAgentConsolePorts().task.saveTaskDetail(taskId, { subtasks });
  },

  setChatDrawerOpen: (open) => set({ chatDrawerOpen: open }),

  openArtifactPreview: (artifact) => set({ previewArtifact: artifact }),

  closeArtifactPreview: () => set({ previewArtifact: null }),
}));
