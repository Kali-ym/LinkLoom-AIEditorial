import type { ConsoleConfig } from '../../domain/types';
import type { FollowUpFetchParams } from '../../domain/types/followUp';
import type { IRuntimePort } from '../ports/IRuntimePort';
import { fetchLatestContextUsageForTopic } from './contextUsage';
import {
  approveRunPermission,
  rejectRunPermission,
  resolveRunHitl,
} from './agentRunControl';
import {
  authorizePendingTool,
  fetchPendingAuthTools,
  resolveToolAuthPopupUrl,
} from './toolAuthActions';

/** Plus 菜单能力开关：api 模式与 mock 对齐，避免 EMPTY_CONSOLE_CONFIG 误关「工具」等入口。 */
const API_CONSOLE_CONFIG: ConsoleConfig = {
  enableBusinessFeatures: true,
  showInputFootnote: true,
  isDevMode: false,
  enableKnowledgeBase: true,
  enableGatewayMode: true,
  enableFC: true,
  showProviderSearch: true,
  enableInputMarkdown: true,
};

/** Minimal api runtime port — HITL resolve/permission via agentRunControl REST. */
export const apiRuntimePort: IRuntimePort = {
  async getConsoleConfig() {
    return { ...API_CONSOLE_CONFIG };
  },

  async getAuthorsByUserId() {
    return {};
  },

  async getPendingAuthTools(agentId?: string) {
    return fetchPendingAuthTools(agentId);
  },

  async getQueueDemoItems() {
    return [];
  },

  async fetchFollowUpChips(_params: FollowUpFetchParams) {
    void _params;
    // No REST follow-up endpoint yet — chips arrive via SSE or future API.
    return [];
  },

  fetchLatestContextUsageForTopic,

  authorizePendingTool,

  resolveToolAuthPopupUrl,

  approveRunPermission,

  rejectRunPermission,

  resolveRunHitl,
};
