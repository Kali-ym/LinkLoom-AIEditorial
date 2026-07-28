import { fetchTaskDetailPage } from '../taskDetailAdapter';
import { saveTaskDetailPage } from '../taskDetailApiAdapter';
import { fetchTaskGroupsForAgent } from '../taskAdapter';
import type { ITaskPort } from '../ports/ITaskPort';
import { getMockTaskGroups } from './seeds/taskSeed';

export const mockTaskPort: ITaskPort = {
  async getTaskGroups(agentId) {
    void agentId;
    return getMockTaskGroups();
  },

  fetchTaskGroups: fetchTaskGroupsForAgent,
  fetchTaskDetail: fetchTaskDetailPage,
  saveTaskDetail: saveTaskDetailPage,
};
