import type { ITaskPort } from '../ports/ITaskPort';
import type { SidebarTask } from '../../domain/types';
import { listAgentRunsForAgent } from './agentRun';
import { agentConsoleGetJson } from './http';
import { mapAgentRunsToTaskGroups } from './mappers/taskGroups';
import {
  mapRunDetailToTaskPage,
  type BackendRunDetailDto,
} from './mappers/taskDetail';

async function loadTaskGroupsForAgent(agentId: string) {
  const page = await listAgentRunsForAgent(agentId);
  return mapAgentRunsToTaskGroups(page.items);
}

export const apiTaskPort: ITaskPort = {
  async getTaskGroups(agentId) {
    return loadTaskGroupsForAgent(agentId);
  },

  async fetchTaskGroups(agentId) {
    return loadTaskGroupsForAgent(agentId);
  },

  async fetchTaskDetail(task: SidebarTask | undefined) {
    const runId = task?.id;
    if (!runId) return null;

    const detail = await agentConsoleGetJson<BackendRunDetailDto>(
      `/api/agent-runs/${encodeURIComponent(runId)}`,
    );
    return mapRunDetailToTaskPage(detail, task);
  },

  async saveTaskDetail(taskId, patch) {
    void taskId;
    void patch;
    // Task detail edits are client-local until a dedicated task API exists.
  },
};
