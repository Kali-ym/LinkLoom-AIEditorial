import type { Topic, TopicStatus, TopicThread } from '../../../domain/types';
import { getClientTopic } from '../../../services/topic/clientTopicStorage';
import type { BackendAgentRunDto } from '../types/session';

export interface SessionAggregate {
  sessionId: string;
  agentId?: string;
  runs: BackendAgentRunDto[];
  latestRun: BackendAgentRunDto;
  threadIds: Set<string>;
}

/**
 * Session ↔ Topic mapping.
 * Interim: `topicId === sessionId` (including client `tpc_*` ids until first run).
 */
export function topicIdToSessionId(topicId: string): string {
  return topicId;
}

export function sessionIdToTopicId(sessionId: string): string {
  return sessionId;
}

export {
  isClientOnlyTopicId,
  isEphemeralTopicId,
} from '../../../services/topic/clientTopicStorage';

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function aggregateSessionsFromRuns(
  runs: BackendAgentRunDto[] | null | undefined,
): SessionAggregate[] {
  const visibleRuns = (runs ?? []).filter(
    (run) => run.status !== 'archived' && run.metadata?.topicDeleted !== true,
  );
  const bySession = new Map<string, BackendAgentRunDto[]>();

  for (const run of visibleRuns) {
    if (!run.sessionId) continue;
    const list = bySession.get(run.sessionId) ?? [];
    list.push(run);
    bySession.set(run.sessionId, list);
  }

  return [...bySession.entries()]
    .map(([sessionId, sessionRuns]) => {
      const sorted = [...sessionRuns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const threadIds = new Set<string>();
      for (const run of sessionRuns) {
        if (run.threadId) threadIds.add(run.threadId);
      }
      return {
        sessionId,
        agentId: sorted[0]?.agentId,
        runs: sessionRuns,
        latestRun: sorted[0]!,
        threadIds,
      };
    })
    .sort((a, b) => b.latestRun.updatedAt.localeCompare(a.latestRun.updatedAt));
}

export function mapRunStatusToTopicStatus(run: BackendAgentRunDto): TopicStatus {
  if (run.pendingPermission || run.pendingHitl) return 'waiting';

  switch (run.status) {
    case 'queued':
    case 'running':
    case 'cancelling':
      return 'running';
    case 'paused':
      return 'waiting';
    case 'failed':
      return 'failed';
    case 'succeeded':
    case 'cancelled':
    case 'archived':
      return 'completed';
    default:
      return 'completed';
  }
}

export function resolveTopicTitle(aggregate: SessionAggregate): string {
  for (const run of aggregate.runs) {
    const fromMeta =
      readMetadataString(run.metadata, 'topicTitle') ??
      readMetadataString(run.metadata, 'title');
    if (fromMeta) return fromMeta.slice(0, 80);
  }

  const preview = aggregate.latestRun.outputPreview?.trim();
  if (preview) return preview.slice(0, 80);

  if (getClientTopic(aggregate.sessionId)?.title) {
    return getClientTopic(aggregate.sessionId)!.title.slice(0, 80);
  }

  if (aggregate.sessionId.startsWith('temp-') || aggregate.sessionId.startsWith('tpc_')) {
    return '新话题';
  }

  return `会话 ${aggregate.sessionId.slice(0, 8)}`;
}

export function mapSessionToTopic(
  aggregate: SessionAggregate,
  agentId: string,
  activeTopicId?: string,
): Topic {
  const topicId = sessionIdToTopicId(aggregate.sessionId);
  const { latestRun } = aggregate;
  const createdAt = aggregate.runs.reduce(
    (min, run) => (run.createdAt < min ? run.createdAt : min),
    latestRun.createdAt,
  );

  return {
    id: topicId,
    title: resolveTopicTitle(aggregate),
    status: mapRunStatusToTopicStatus(latestRun),
    agentId,
    active: activeTopicId === topicId,
    createdAt,
    updatedAt: latestRun.updatedAt,
    workingDirectory: readMetadataString(latestRun.metadata, 'workingDirectory'),
    fav: latestRun.metadata?.fav === true,
  };
}

export function mapSessionThreads(_aggregate: SessionAggregate): TopicThread[] {
  return [];
}

export function computeSessionElapsed(run: BackendAgentRunDto): string | undefined {
  if (run.status !== 'running' && run.status !== 'queued' && run.status !== 'cancelling') {
    return undefined;
  }

  const startMs = new Date(run.createdAt).getTime();
  if (!Number.isFinite(startMs)) return undefined;

  const totalSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function buildTopicSidebarData(
  runs: BackendAgentRunDto[] | null | undefined,
  agentId: string,
  activeTopicId?: string,
): {
  topics: Topic[];
  threadsByTopicId: Record<string, TopicThread[]>;
  elapsedByTopicId: Record<string, string>;
} {
  const aggregates = aggregateSessionsFromRuns(runs);
  const topics = aggregates.map((aggregate) =>
    mapSessionToTopic(aggregate, agentId, activeTopicId),
  );

  const threadsByTopicId: Record<string, TopicThread[]> = {};
  const elapsedByTopicId: Record<string, string> = {};

  for (const aggregate of aggregates) {
    const topicId = sessionIdToTopicId(aggregate.sessionId);
    threadsByTopicId[topicId] = mapSessionThreads(aggregate);
    const elapsed = computeSessionElapsed(aggregate.latestRun);
    if (elapsed) elapsedByTopicId[topicId] = elapsed;
  }

  return { topics, threadsByTopicId, elapsedByTopicId };
}
