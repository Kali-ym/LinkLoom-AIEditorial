import { parseTopicImportJson } from '../topicImportAdapter';
import { TopicMoveError } from '../topicMoveAdapter';
import { enrichTopicsForView } from '../topicViewAdapter';
import type { ITopicPort } from '../ports/ITopicPort';
import type { Topic } from '../../domain/types';
import type {
  FetchAgentTopicsViewParams,
  FetchAgentTopicsViewResult,
  TopicImportPayload,
} from '../types';
import { TOPICS_VIEW_API_PAGE_SIZE } from '../topicsViewApiAdapter';
import { readStoredActiveTopicId } from './activeTopicStorage';
import { listAgentRunsForAgent, resolveActiveAgentId, startAgentRun } from './agentRun';
import {
  AgentConsoleApiError,
  agentConsoleDeleteJson,
  agentConsoleGetJson,
  agentConsolePatchJson,
} from './http';
import {
  aggregateSessionsFromRuns,
  buildTopicSidebarData,
  computeSessionElapsed,
  isEphemeralTopicId,
  mapSessionThreads,
  sessionIdToTopicId,
  topicIdToSessionId,
} from './mappers/sessionTopic';
import {
  mapImportMessagesToRunContext,
  resolveImportRunInput,
  resolveImportSessionId,
  resolveImportTitle,
} from './mappers/topicImport';
import type { BackendSessionGroupStateDto } from './types/session';

const inflightTopicSidebar = new Map<string, Promise<ReturnType<typeof buildTopicSidebarData>>>();

/** Drop cached sidebar fetch so the next load gets a fresh backend snapshot. */
export function clearTopicSidebarInflight(agentId?: string): void {
  if (agentId) {
    inflightTopicSidebar.delete(agentId);
    return;
  }
  inflightTopicSidebar.clear();
}

async function loadAgentTopicSidebar(agentId: string) {
  const inflight = inflightTopicSidebar.get(agentId);
  if (inflight) return inflight;

  const promise = (async () => {
    const activeTopicId = readStoredActiveTopicId(agentId) ?? undefined;
    const page = await listAgentRunsForAgent(agentId);
    return buildTopicSidebarData(page.items, agentId, activeTopicId);
  })();

  inflightTopicSidebar.set(agentId, promise);
  try {
    return await promise;
  } finally {
    if (inflightTopicSidebar.get(agentId) === promise) {
      inflightTopicSidebar.delete(agentId);
    }
  }
}

function findSessionAggregate(agentId: string, topicId: string) {
  return listAgentRunsForAgent(agentId).then((page) => {
    const aggregates = aggregateSessionsFromRuns(page.items);
    const sessionId = topicIdToSessionId(topicId);
    return aggregates.find((item) => item.sessionId === sessionId) ?? null;
  });
}

export const apiTopicPort: ITopicPort = {
  async getActiveTopicId() {
    const agentId = await resolveActiveAgentId();
    const stored = readStoredActiveTopicId(agentId);
    if (stored) return stored;

    const { topics } = await loadAgentTopicSidebar(agentId);
    return topics[0]?.id ?? '';
  },

  async getTopicSidebar(agentId) {
    return loadAgentTopicSidebar(agentId);
  },

  async listTopics(agentId) {
    const { topics } = await loadAgentTopicSidebar(agentId);
    return topics;
  },

  async getThreadsByTopicId() {
    const agentId = await resolveActiveAgentId();
    const { threadsByTopicId } = await loadAgentTopicSidebar(agentId);
    return threadsByTopicId;
  },

  async getElapsedByTopicId() {
    const agentId = await resolveActiveAgentId();
    const { elapsedByTopicId } = await loadAgentTopicSidebar(agentId);
    return elapsedByTopicId;
  },

  async getThreads(topicId) {
    const agentId = await resolveActiveAgentId();
    const aggregate = await findSessionAggregate(agentId, topicId);
    if (!aggregate) return [];
    return mapSessionThreads(aggregate);
  },

  async getElapsed(topicId) {
    const agentId = await resolveActiveAgentId();
    const aggregate = await findSessionAggregate(agentId, topicId);
    if (!aggregate) return undefined;
    return computeSessionElapsed(aggregate.latestRun);
  },

  async renameTopic(topicId, title) {
    if (isEphemeralTopicId(topicId)) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    await agentConsolePatchJson(
      `/api/agent-sessions/${encodeURIComponent(topicIdToSessionId(topicId))}`,
      { topicTitle: trimmed },
    );
  },

  async saveSnapshot(topicId) {
    if (isEphemeralTopicId(topicId)) return;
    // Mark-complete is client-driven; server already persists messages on each run.
  },

  async batchMove() {
    throw new TopicMoveError('当前后端暂不支持跨助手移动话题');
  },

  async persistImport(payload: TopicImportPayload, fileName: string) {
    const agentId = await resolveActiveAgentId();
    const title = resolveImportTitle(payload, fileName);
    const messages = mapImportMessagesToRunContext(payload.messages);
    if (!messages.length) {
      throw new Error('导入失败：缺少可识别的 user/assistant 消息');
    }

    const sessionId = resolveImportSessionId();
    const input = resolveImportRunInput(messages, title);
    const result = await startAgentRun({
      agentId,
      topicId: sessionId,
      message: input,
      stream: false,
      metadata: { topicTitle: title, imported: true },
      messages,
    });

    return {
      id: sessionIdToTopicId(result.sessionId),
      title,
    };
  },

  async deleteTopic(topicId) {
    try {
      await agentConsoleDeleteJson(
        `/api/agent-sessions/${encodeURIComponent(topicIdToSessionId(topicId))}`,
      );
    } catch (error) {
      // Client-only drafts (no runs yet) may 404 — treat as already deleted.
      if (error instanceof AgentConsoleApiError && error.status === 404) return;
      throw error;
    }
  },

  parseImportJson: parseTopicImportJson,

  async fetchTopicsViewPage({
    agentId,
    page,
    pageSize = TOPICS_VIEW_API_PAGE_SIZE,
    sourceItems,
  }: FetchAgentTopicsViewParams): Promise<FetchAgentTopicsViewResult> {
    const enriched =
      sourceItems.length > 0
        ? sourceItems
        : enrichTopicsForView((await loadAgentTopicSidebar(agentId)).topics);

    const end = page * pageSize;
    return {
      items: enriched.slice(0, end),
      hasMore: enriched.length > end,
      total: enriched.length,
    };
  },
};

/** Optional: hydrate a single topic from session REST (used when session exists without runs yet). */
export async function fetchSessionTopic(
  sessionId: string,
  agentId: string,
): Promise<Topic | null> {
  try {
    const state = await agentConsoleGetJson<BackendSessionGroupStateDto>(
      `/api/agent-sessions/${encodeURIComponent(sessionId)}`,
    );
    const topicId = sessionIdToTopicId(state.sessionId);
    return {
      id: topicId,
      title: readTopicTitleFromMetadata(state.metadata) ?? `会话 ${topicId.slice(0, 8)}`,
      status: mapSessionStatusToTopicStatus(state.status),
      agentId,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };
  } catch (error) {
    if (error instanceof AgentConsoleApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function readTopicTitleFromMetadata(metadata?: Record<string, unknown>): string | undefined {
  const title = metadata?.topicTitle ?? metadata?.title;
  return typeof title === 'string' && title.trim() ? title.slice(0, 80) : undefined;
}

function mapSessionStatusToTopicStatus(status?: string): Topic['status'] {
  switch (status) {
    case 'running':
    case 'queued':
    case 'cancelling':
      return 'running';
    case 'paused':
      return 'waiting';
    case 'failed':
      return 'failed';
    default:
      return 'completed';
  }
}
