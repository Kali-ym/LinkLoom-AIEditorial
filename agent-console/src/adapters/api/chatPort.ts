import type { IChatPort, SendMessageInput } from '../ports/IChatPort';
import type { Message } from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import {
  AgentConsoleApiError,
  agentConsoleGetJson,
} from './http';
import { listAgentRunsForAgent, resolveActiveAgentId, startAgentRun } from './agentRun';
import { editSessionMessage, regenerateSessionMessage } from './sessionMessageActions';
import { mapBackendMessagesToDomain } from './mappers/message';
import {
  isEphemeralTopicId,
  sessionIdToTopicId,
  topicIdToSessionId,
} from './mappers/sessionTopic';
import type { BackendSessionMessagesDto } from './types/message';
import { readStoredActiveTopicId } from './activeTopicStorage';

async function fetchSessionMessages(sessionId: string): Promise<Message[]> {
  try {
    const response = await agentConsoleGetJson<BackendSessionMessagesDto>(
      `/api/agent-sessions/${encodeURIComponent(sessionId)}/messages`,
    );
    return mapBackendMessagesToDomain(
      response.messages ?? [],
      response.sessionId,
      response.threadId,
    );
  } catch (error) {
    if (error instanceof AgentConsoleApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

/** Resolve active topic for bootstrap without pulling every session's messages. */
async function resolveBootstrapActiveTopicId(agentId: string): Promise<string> {
  const stored = readStoredActiveTopicId(agentId);
  if (stored && !isEphemeralTopicId(stored)) return stored;

  const page = await listAgentRunsForAgent(agentId);
  const firstSessionId = page.items.find((run) => run.sessionId)?.sessionId;
  return firstSessionId ? sessionIdToTopicId(firstSessionId) : '';
}

export const apiChatPort: IChatPort = {
  /**
   * Bootstrap path: only hydrate the active topic's messages.
   * Other topics load on demand via getMessages / MessagesHydration.
   */
  async getMessagesByTopicId() {
    const agentId = await resolveActiveAgentId();
    const topicId = await resolveBootstrapActiveTopicId(agentId);
    if (!topicId || isEphemeralTopicId(topicId)) {
      return {};
    }

    const messages = await fetchSessionMessages(topicIdToSessionId(topicId));
    return { [topicId]: messages };
  },

  async getMessages(topicId) {
    if (isEphemeralTopicId(topicId)) return [];
    return fetchSessionMessages(topicIdToSessionId(topicId));
  },

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const agentId = await resolveActiveAgentId();
    const result = await startAgentRun({
      agentId,
      topicId: input.topicId,
      message: input.text,
      threadId: input.threadId,
    });

    return {
      id: `user-${result.runId}`,
      role: 'user',
      content: input.text,
      text: input.text,
      createdAt: result.createdAt,
      threadId: input.threadId,
    };
  },

  async editMessage(topicId, messageId, payload: UserTurnPayload) {
    return editSessionMessage(topicId, messageId, payload);
  },

  async regenerateMessage(topicId, messageId) {
    const result = await regenerateSessionMessage(topicId, messageId);
    return result.message;
  },
};
