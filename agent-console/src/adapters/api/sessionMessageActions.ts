import type { Message } from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import {
  agentConsolePatchJson,
  agentConsolePostJson,
} from './http';
import { mapBackendMessageToDomain } from './mappers/message';
import { topicIdToSessionId } from './mappers/sessionTopic';
import type { BackendAgentMessageDto } from './types/message';

interface BackendMessageMutationDto {
  sessionId: string;
  message: BackendAgentMessageDto;
}

export interface RegenerateMessageResult {
  message: Message;
  runId: string;
  input: string;
}

function mapMutationMessage(_topicId: string, dto: BackendMessageMutationDto): Message {
  const mapped = mapBackendMessageToDomain(dto.message, 0, dto.sessionId);
  if (!mapped) {
    throw new Error('Failed to map edited message');
  }
  return mapped;
}

export async function editSessionMessage(
  topicId: string,
  messageId: string,
  payload: UserTurnPayload,
): Promise<Message> {
  const sessionId = topicIdToSessionId(topicId);
  const result = await agentConsolePatchJson<BackendMessageMutationDto>(
    `/api/agent-sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
    payload,
  );
  return mapMutationMessage(topicId, result);
}

export async function regenerateSessionMessage(
  topicId: string,
  messageId: string,
): Promise<RegenerateMessageResult> {
  const sessionId = topicIdToSessionId(topicId);
  const result = await agentConsolePostJson<{
    runId: string;
    input: string;
    message: BackendAgentMessageDto;
    sessionId: string;
  }>(
    `/api/agent-sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/regenerate`,
    {},
  );
  return {
    runId: result.runId,
    input: result.input,
    message: mapMutationMessage(topicId, {
      sessionId: result.sessionId,
      message: result.message,
    }),
  };
}
