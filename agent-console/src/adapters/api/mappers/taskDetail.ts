import type { SidebarTask } from '../../../domain/types/task';
import type { TaskDetailActivity, TaskDetailPageData } from '../../../domain/types/taskDetailPage';
import { sessionIdToTopicId } from './sessionTopic';
import { mapRunToTaskStatus, resolveTaskName } from './taskGroups';

export interface BackendRunDetailDto {
  runId: string;
  sessionId?: string;
  agentId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  outputPreview?: string;
  metadata?: Record<string, unknown>;
  pendingPermission?: unknown;
  pendingHitl?: unknown;
  artifacts?: Array<{
    artifactId: string;
    kind?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  }>;
  checkpoints?: Array<{
    checkpointId: string;
    reason?: string;
    createdAt?: string;
  }>;
  messages?: unknown[];
}

function readHitlPrompt(pendingHitl: unknown): string | undefined {
  if (!pendingHitl || typeof pendingHitl !== 'object') return undefined;
  const prompt = (pendingHitl as { prompt?: unknown }).prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : undefined;
}

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildActivities(detail: BackendRunDetailDto): TaskDetailActivity[] {
  const activities: TaskDetailActivity[] = [];
  if (detail.createdAt) {
    activities.push({ id: `${detail.runId}-created`, label: '任务创建', at: detail.createdAt });
  }
  for (const checkpoint of detail.checkpoints ?? []) {
    if (!checkpoint.createdAt) continue;
    activities.push({
      id: checkpoint.checkpointId,
      label: checkpoint.reason?.trim() || '检查点',
      at: checkpoint.createdAt,
    });
  }
  if (detail.updatedAt && detail.updatedAt !== detail.createdAt) {
    activities.push({ id: `${detail.runId}-updated`, label: '状态更新', at: detail.updatedAt });
  }
  return activities;
}

export function mapRunDetailToTaskPage(
  detail: BackendRunDetailDto,
  sidebarTask?: SidebarTask,
): TaskDetailPageData {
  const runForStatus = {
    runId: detail.runId,
    sessionId: detail.sessionId ?? '',
    status: detail.status ?? 'running',
    createdAt: detail.createdAt ?? new Date().toISOString(),
    updatedAt: detail.updatedAt ?? detail.createdAt ?? new Date().toISOString(),
    metadata: detail.metadata,
    pendingPermission: detail.pendingPermission,
    pendingHitl: detail.pendingHitl,
    outputPreview: detail.outputPreview,
  };

  const title = sidebarTask?.name?.trim() || resolveTaskName(runForStatus);
  const instruction =
    readHitlPrompt(detail.pendingHitl) ??
    readMetadataString(detail.metadata, 'instruction') ??
    detail.outputPreview ??
    `查看运行 ${detail.runId} 的详情与关联话题。`;

  return {
    id: detail.runId,
    identifier: sidebarTask?.identifier ?? detail.sessionId?.slice(0, 16) ?? detail.runId.slice(0, 16),
    title,
    status: sidebarTask?.status ?? mapRunToTaskStatus(runForStatus),
    instruction,
    model: readMetadataString(detail.metadata, 'model'),
    assignee: detail.agentId,
    parentLabel: readMetadataString(detail.metadata, 'workflowId'),
    topicId: detail.sessionId ? sessionIdToTopicId(detail.sessionId) : sidebarTask?.topicId,
    subtasks: [],
    artifacts: (detail.artifacts ?? []).map((artifact) => ({
      id: artifact.artifactId,
      name: readMetadataString(artifact.metadata, 'fileName') ?? artifact.kind ?? artifact.artifactId,
      type: artifact.kind ?? 'file',
    })),
    activities: buildActivities(detail),
  };
}
