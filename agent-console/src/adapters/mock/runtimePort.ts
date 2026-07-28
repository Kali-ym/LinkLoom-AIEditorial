import { fetchFollowUpChips } from '../followUpAdapter';
import type { RunHitlResolveBody } from '../../domain/types/runHitl';
import type { IRuntimePort } from '../ports/IRuntimePort';
import { getMockAuthorsByUserId, getMockConsoleConfig } from './seeds/configSeed';
import { getMockPendingAuthTools, getMockQueueDemoItems } from './seeds/runtimeSeed';

export const mockRuntimePort: IRuntimePort = {
  async getConsoleConfig() {
    return getMockConsoleConfig();
  },

  async getAuthorsByUserId() {
    return getMockAuthorsByUserId();
  },

  async getPendingAuthTools(_agentId?: string) {
    void _agentId;
    return getMockPendingAuthTools();
  },

  async getQueueDemoItems() {
    return getMockQueueDemoItems();
  },

  fetchFollowUpChips,

  async fetchLatestContextUsageForTopic() {
    return null;
  },

  async authorizePendingTool(_agentId: string, _toolId: string) {
    void _agentId;
    void _toolId;
    return { authUrl: 'about:blank', state: 'mock' };
  },

  resolveToolAuthPopupUrl(authUrl: string) {
    return authUrl;
  },

  async approveRunPermission(_runId: string, _permissionId: string, _body?: { reason?: string }) {
    void _runId;
    void _permissionId;
    void _body;
    return undefined;
  },

  async rejectRunPermission(_runId: string, _permissionId: string, _body?: { reason?: string }) {
    void _runId;
    void _permissionId;
    void _body;
    return undefined;
  },

  async resolveRunHitl(_runId: string, _requestId: string, _body: RunHitlResolveBody) {
    void _runId;
    void _requestId;
    void _body;
    return undefined;
  },
};
