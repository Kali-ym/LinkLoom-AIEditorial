import type { SidebarTask, TaskGroup, TaskGroupKey, TaskStatus } from '../../../domain/types/task';
import type { BackendAgentRunDto } from '../types/session';
import { sessionIdToTopicId } from './sessionTopic';

const ACTIVE_RUN_STATUSES = new Set(['queued', 'running', 'cancelling', 'paused', 'failed']);

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPermissionToolName(pendingPermission: unknown): string | undefined {
  if (!pendingPermission || typeof pendingPermission !== 'object') return undefined;
  const subject = (pendingPermission as { subject?: unknown }).subject;
  if (!subject || typeof subject !== 'object') return undefined;
  const record = subject as Record<string, unknown>;
  const toolName = record.toolName ?? record.exposedName;
  return typeof toolName === 'string' && toolName.trim() ? toolName.trim() : undefined;
}

function readHitlPrompt(pendingHitl: unknown): string | undefined {
  if (!pendingHitl || typeof pendingHitl !== 'object') return undefined;
  const prompt = (pendingHitl as { prompt?: unknown }).prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : undefined;
}

export function mapRunToTaskStatus(run: BackendAgentRunDto): TaskStatus {
  if (run.pendingPermission || run.pendingHitl || run.status === 'paused') return 'paused';
  if (run.status === 'failed') return 'failed';
  if (run.status === 'queued') return 'scheduled';
  if (run.status === 'running' || run.status === 'cancelling') return 'running';
  if (readMetadataString(run.metadata, 'taskStatus') === 'backlog') return 'backlog';
  return 'running';
}

export function classifyRunTaskGroup(run: BackendAgentRunDto): TaskGroupKey | null {
  if (run.metadata?.topicDeleted === true) return null;
  if (run.status === 'archived') return null;

  if (run.pendingPermission || run.pendingHitl || run.status === 'paused') {
    return 'needsInput';
  }
  if (run.status === 'failed') return 'needsInput';
  if (readMetadataString(run.metadata, 'taskStatus') === 'backlog') return 'backlog';
  if (ACTIVE_RUN_STATUSES.has(run.status)) return 'running';

  return null;
}

export function resolveTaskName(run: BackendAgentRunDto): string {
  const topicTitle =
    readMetadataString(run.metadata, 'topicTitle') ?? readMetadataString(run.metadata, 'title');
  if (topicTitle) return topicTitle.slice(0, 80);

  const toolName = readPermissionToolName(run.pendingPermission);
  if (toolName) return `审批工具调用：${toolName}`;

  const hitlPrompt = readHitlPrompt(run.pendingHitl);
  if (hitlPrompt) return hitlPrompt.slice(0, 80);

  const preview = run.outputPreview?.trim();
  if (preview) return preview.slice(0, 80);

  return `运行 ${run.runId.slice(0, 12)}`;
}

export function resolveTaskIdentifier(run: BackendAgentRunDto): string {
  const toolName = readPermissionToolName(run.pendingPermission);
  if (toolName) return toolName;
  if (run.sessionId) return run.sessionId.slice(0, 16);
  return run.runId.slice(0, 16);
}

export function mapRunToSidebarTask(run: BackendAgentRunDto): SidebarTask {
  return {
    id: run.runId,
    identifier: resolveTaskIdentifier(run),
    name: resolveTaskName(run),
    status: mapRunToTaskStatus(run),
    topicId: run.sessionId ? sessionIdToTopicId(run.sessionId) : undefined,
  };
}

export function mapAgentRunsToTaskGroups(runs: BackendAgentRunDto[]): TaskGroup[] {
  const groups: Record<TaskGroupKey, SidebarTask[]> = {
    needsInput: [],
    backlog: [],
    running: [],
  };

  for (const run of runs) {
    const key = classifyRunTaskGroup(run);
    if (!key) continue;
    groups[key].push(mapRunToSidebarTask(run));
  }

  return (['needsInput', 'backlog', 'running'] as const)
    .map((key) => ({ key, tasks: groups[key] }))
    .filter((group) => group.tasks.length > 0);
}
