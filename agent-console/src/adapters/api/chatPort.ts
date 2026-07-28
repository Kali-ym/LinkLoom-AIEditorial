import type { IChatPort, SendMessageInput } from '../ports/IChatPort';
import type { Message } from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import {
  AgentConsoleApiError,
  agentConsoleGetJson,
} from './http';
import { resolveActiveAgentId, startAgentRun } from './agentRun';
import { editSessionMessage, regenerateSessionMessage } from './sessionMessageActions';
import { mapBackendMessagesToDomain } from './mappers/message';
import {
  isEphemeralTopicId,
  sessionIdToTopicId,
  topicIdToSessionId,
} from './mappers/sessionTopic';
import type { BackendSessionMessagesDto } from './types/message';
import type { BackendAgentRunPageDto } from './types/session';

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

export const apiChatPort: IChatPort = {
  async getMessagesByTopicId() {
    const agentId = await resolveActiveAgentId();
    const page = await agentConsoleGetJson<BackendAgentRunPageDto>(
      `/api/agent-runs?agentId=${encodeURIComponent(agentId)}&limit=100`,
    );

    const sessionIds = [
      ...new Set(
        page.items
          .map((run) => run.sessionId)
          .filter((sessionId): sessionId is string => Boolean(sessionId)),
      ),
    ];

    const entries = await Promise.all(
      sessionIds.map(async (sessionId) => {
        const messages = await fetchSessionMessages(sessionId);
        return [sessionIdToTopicId(sessionId), messages] as const;
      }),
    );

    return Object.fromEntries(entries);
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
