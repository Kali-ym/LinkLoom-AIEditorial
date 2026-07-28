import type { AuthorInfo, ConsoleConfig, QueueItem } from '../../domain/types';
import type { TopicContextUsage } from '../../domain/types/contextUsage';
import type { FollowUpChip, FollowUpFetchParams } from '../../domain/types/followUp';
import type { RunHitlResolveBody } from '../../domain/types/runHitl';
import type { PendingAuthTool } from '../../domain/types/toolAuth';

export interface IRuntimePort {
  getConsoleConfig(): Promise<ConsoleConfig>;
  getAuthorsByUserId(): Promise<Record<string, AuthorInfo>>;
  getPendingAuthTools(agentId?: string): Promise<PendingAuthTool[]>;
  getQueueDemoItems(): Promise<QueueItem[]>;
  fetchFollowUpChips(params: FollowUpFetchParams): Promise<FollowUpChip[]>;
  fetchLatestContextUsageForTopic(topicId: string, agentId: string): Promise<TopicContextUsage | null>;
  authorizePendingTool(agentId: string, toolId: string): Promise<{ authUrl: string; state: string }>;
  resolveToolAuthPopupUrl(authUrl: string): string;
  approveRunPermission(runId: string, permissionId: string, body?: { reason?: string }): Promise<unknown>;
  rejectRunPermission(runId: string, permissionId: string, body?: { reason?: string }): Promise<unknown>;
  resolveRunHitl(runId: string, requestId: string, body: RunHitlResolveBody): Promise<unknown>;
}
