import type { AgentEventItem } from '../../utils/agentEvents';
import type { TopicContextUsage } from '../../domain/types/contextUsage';
import { extractTokenUsage } from '../../utils/tokenUsage';
import { agentConsoleGetJson } from './http';
import { topicIdToSessionId } from './mappers/sessionTopic';
import type { BackendAgentRunPageDto } from './types/session';

/** Load last model_finished usage for a topic session (post-refresh hydration). */
export async function fetchLatestContextUsageForTopic(
  topicId: string,
  agentId: string,
): Promise<TopicContextUsage | null> {
  if (!agentId || !topicId) return null;

  const sessionId = topicIdToSessionId(topicId);
  const page = await agentConsoleGetJson<BackendAgentRunPageDto>(
    `/api/agent-runs?agentId=${encodeURIComponent(agentId)}&limit=50`,
  );

  const latestRun = page.items
    .filter((run) => run.sessionId === sessionId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!latestRun?.runId) return null;

  const events = await agentConsoleGetJson<AgentEventItem[]>(
    `/api/agent-runs/${encodeURIComponent(latestRun.runId)}/events`,
  );

  const lastModelFinished = [...events].reverse().find((event) => event.type === 'model_finished');
  if (!lastModelFinished) return null;

  const usage = extractTokenUsage(lastModelFinished.payload.usage);
  if (!usage.promptTokens) return null;

  return {
    ...usage,
    updatedAt: lastModelFinished.timestamp,
  };
}
