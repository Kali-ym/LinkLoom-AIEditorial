import { AppError } from '../../domain/errors.js';
import { AgentService } from './AgentService.js';
import type { AgentMessage } from './engine/AgentRunSpec.js';
import type { AgentSession } from './engine/AgentSession.js';
import {
  isArchivableRunStatus,
  isCancellationRequestableRunStatus,
} from './engine/AgentRunStateMachine.js';
import {
  buildConsoleMessageId,
  parseConsoleMessageId,
  stringifyAgentMessageContent,
} from './sessionMessageUtils.js';
import { readUserTurnMetadata } from './userTurnRuntime.js';
import {
  buildFilesOnlyPrompt,
  buildUserTurnMessageMetadata,
  sanitizeUserTurnMessageForImages,
  fileRefsFromChatItems,
  type NormalizedUserTurn,
  type ResolvedUserTurnFiles,
} from './userTurnPayload.js';

export interface LocatedSessionMessage {
  session: AgentSession;
  role: 'user' | 'assistant';
  runIndex: number;
}

export class SessionMessageService {
  constructor(private readonly agentService: AgentService) {}

  async locateMessage(sessionId: string, messageId: string): Promise<LocatedSessionMessage> {
    const runs = await this.agentService.getSessionRuns(sessionId);
    if (runs.length === 0) {
      throw new AppError(404, `Agent session not found: ${sessionId}`);
    }

    const parsed = parseConsoleMessageId(messageId);
    if (parsed) {
      const runIndex = runs.findIndex((run) => run.runId === parsed.runId);
      if (runIndex >= 0) {
        return {
          session: runs[runIndex],
          role: parsed.kind,
          runIndex,
        };
      }
    }

    for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
      const session = runs[runIndex];
      const turnMessages = this.agentService.getSessionTurnMessages(session);
      for (let index = 0; index < turnMessages.length; index += 1) {
        const message = turnMessages[index];
        const syntheticId =
          message.id ??
          buildConsoleMessageId(
            session.runId,
            message.role === 'assistant' ? 'assistant' : 'user',
            index,
          );
        if (syntheticId === messageId || message.id === messageId) {
          return {
            session,
            role: message.role === 'assistant' ? 'assistant' : 'user',
            runIndex,
          };
        }
      }
    }

    throw new AppError(404, `Message not found: ${messageId}`);
  }

  async editMessage(
    sessionId: string,
    messageId: string,
    turn: NormalizedUserTurn,
    resolvedFiles: ResolvedUserTurnFiles,
  ) {
    const located = await this.locateMessage(sessionId, messageId);
    if (located.role !== 'user') {
      throw new AppError(400, 'only user messages can be edited');
    }

    const nextSession = cloneSession(located.session);
    const target = this.findTurnInputUserMessage(nextSession);
    if (!target) {
      throw new AppError(404, `User message not found in run ${located.session.runId}`);
    }

    const sanitizedMessage = sanitizeUserTurnMessageForImages(
      turn.message,
      resolvedFiles.imageList,
    );
    const content =
      sanitizedMessage.trim() ||
      buildFilesOnlyPrompt(resolvedFiles.imageList, resolvedFiles.fileList);

    const userTurnMetadata = buildUserTurnMessageMetadata({
      editorData: turn.editorData,
      fileList: resolvedFiles.fileList,
      imageList: resolvedFiles.imageList,
      message: sanitizedMessage,
    });

    target.content = content;
    target.metadata = {
      ...target.metadata,
      ...userTurnMetadata,
      turnInput: target.metadata?.turnInput ?? true,
      editedAt: new Date().toISOString(),
    };

    await this.agentService.saveRunSession(nextSession);
    await this.archiveRunsFromIndex(sessionId, located.runIndex + 1, 'message_edited');

    return {
      sessionId,
      message: this.toResponseMessage(nextSession, target),
    };
  }

  async prepareRegeneration(sessionId: string, messageId: string) {
    const located = await this.locateMessage(sessionId, messageId);
    const runs = await this.agentService.getSessionRuns(sessionId);
    const fromIndex = located.role === 'assistant' ? located.runIndex : located.runIndex;
    await this.archiveRunsFromIndex(sessionId, fromIndex, 'message_regenerated');

    const userTurn = this.resolveUserTurnForRun(located.session);
    if (!userTurn.message.trim() && userTurn.files.length === 0) {
      throw new AppError(400, 'Cannot regenerate without user input');
    }

    const priorMessages = this.buildPriorMessages(runs, fromIndex);
    const agentId = this.resolveAgentId(located.session);
    if (!agentId) {
      throw new AppError(400, 'Cannot determine agentId for regeneration');
    }

    const turnUserMessage = this.findTurnInputUserMessage(located.session);
    const displayInput = turnUserMessage
      ? stringifyAgentMessageContent(turnUserMessage.content)
      : userTurn.message;

    return {
      agentId,
      sessionId,
      threadId: located.session.threadId ?? sessionId,
      userTurn,
      messages: priorMessages,
      message: this.toResponseMessage(located.session, {
        id: messageId,
        role: located.role,
        content:
          located.role === 'user'
            ? displayInput
            : stringifyAgentMessageContent(located.session.output?.content ?? ''),
      }),
    };
  }

  private resolveAgentId(session: AgentSession): string | undefined {
    const metadataAgentId = session.metadata?.agentId;
    return typeof metadataAgentId === 'string' && metadataAgentId.trim()
      ? metadataAgentId
      : undefined;
  }

  private resolveUserTurnForRun(session: AgentSession): NormalizedUserTurn {
    const target = this.findTurnInputUserMessage(session);
    if (!target) {
      return { message: '', files: [] };
    }

    const message = stringifyAgentMessageContent(target.content);
    const metadata = target.metadata ?? {};
    const editorData =
      metadata.editorData && typeof metadata.editorData === 'object'
        ? (metadata.editorData as Record<string, unknown>)
        : undefined;
    const { fileList, imageList } = readUserTurnMetadata(metadata);

    return {
      editorData,
      files: fileRefsFromChatItems(imageList, fileList),
      message,
    };
  }

  private findTurnInputUserMessage(session: AgentSession): AgentMessage | undefined {
    const userMessages = session.messages.filter((message) => message.role === 'user');
    const turnInputMessages = userMessages.some((message) => message.metadata?.turnInput === true)
      ? userMessages.filter((message) => message.metadata?.turnInput === true)
      : userMessages.slice(-1);
    return turnInputMessages.at(-1) ?? userMessages.at(-1);
  }

  private buildPriorMessages(runs: AgentSession[], fromRunIndex: number): AgentMessage[] {
    return runs.slice(0, fromRunIndex).flatMap((run) =>
      this.agentService
        .getSessionTurnMessages(run)
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({
          role: message.role,
          content: stringifyAgentMessageContent(message.content),
        })),
    );
  }

  private async archiveRunsFromIndex(
    sessionId: string,
    fromIndex: number,
    reason: string,
  ): Promise<void> {
    const runs = await this.agentService.getSessionRuns(sessionId);
    for (const session of runs.slice(fromIndex)) {
      if (isCancellationRequestableRunStatus(session.status)) {
        await this.agentService.cancelRun(session.runId, reason);
      }
      const latest = await this.agentService.getRunSession(session.runId);
      if (!latest) continue;
      if (latest.status === 'archived') continue;
      if (isArchivableRunStatus(latest.status)) {
        await this.agentService.archiveRun(latest.runId, reason);
      }
    }
  }

  private toResponseMessage(session: AgentSession, message: AgentMessage) {
    return {
      id:
        message.id ??
        buildConsoleMessageId(
          session.runId,
          message.role === 'assistant' ? 'assistant' : 'user',
          0,
        ),
      role: message.role,
      content: stringifyAgentMessageContent(message.content),
      createdAt: message.createdAt ?? session.updatedAt,
      metadata: {
        ...(message.metadata ?? {}),
        runId: session.runId,
        sessionId: session.sessionId,
        threadId: session.threadId,
      },
    };
  }
}

function cloneSession(session: AgentSession): AgentSession {
  return structuredClone(session);
}
