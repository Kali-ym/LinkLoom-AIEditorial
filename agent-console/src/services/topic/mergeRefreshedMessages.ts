import type { Message } from '../../domain/types';
import type { AssistantTurnSegment } from '../../domain/types/assistantTurnSegment';
import type { ToolPayload } from '../../domain/types/tool';
import { messageHasPendingIntervention } from '../../selectors/pendingInterventions';
import { isPermissionPauseToolError } from '../../domain/utils/toolReference';
function hasAssistantTools(message: Message): boolean {
  return Boolean(message.tool || (message.tools && message.tools.length > 0));
}

function normalizePermissionPausedTool<T extends ToolPayload | undefined>(tool: T): T {
  if (!tool || !isPermissionPauseToolError(tool)) return tool;
  if (
    tool.state === 'success' ||
    tool.state === 'rejected' ||
    tool.intervention?.status === 'resolved'
  ) {
    return tool;
  }
  if (tool.intervention?.status === 'pending') {
    return {
      ...tool,
      state: 'pending',
      error: undefined,
      intervention: tool.intervention,
    } as T;
  }
  return {
    ...tool,
    state: 'pending',
    error: undefined,
    intervention: { status: 'pending' },
  } as T;
}

function assistantMessages(messages: Message[]): Message[] {
  return messages.filter((message) => message.role === 'assistant');
}

function shouldPreferLocalTurnSegments(local: Message, api: Message): boolean {
  const localSegments = local.turnSegments;
  if (!localSegments?.length) return false;
  const apiSegments = api.turnSegments;
  if (!apiSegments?.length) return true;

  const apiTools = collectToolsFromTurnSegments(apiSegments);
  const apiByKey = new Map(apiTools.map((tool) => [tool.toolCallId ?? tool.id, tool] as const));

  for (const tool of collectToolsFromTurnSegments(localSegments)) {
    const key = tool.toolCallId ?? tool.id;
    const apiTool = key ? apiByKey.get(key) : undefined;
    if (!apiTool) continue;
    if (
      (tool.state === 'pending' || tool.state === 'executing') &&
      (apiTool.state === 'error' && isPermissionPauseToolError(apiTool))
    ) {
      return true;
    }
    if (
      tool.state === 'success' &&
      Boolean(tool.resultText || tool.resultContent) &&
      apiTool.state === 'error' &&
      !isPermissionPauseToolError(apiTool)
    ) {
      return true;
    }
  }

  return false;
}

function findLocalAssistantPeer(
  apiMessage: Message,
  apiMessages: Message[],
  localMessages: Message[],
  apiIds: Set<string>,
  localById: Map<string, Message>,
): Message | undefined {
  const byId = localById.get(apiMessage.id);
  if (byId) return byId;

  const apiAssistants = assistantMessages(apiMessages);
  const localAssistants = assistantMessages(localMessages);
  const apiIndex = apiAssistants.findIndex((message) => message.id === apiMessage.id);
  if (apiIndex >= 0 && localAssistants[apiIndex]) {
    return localAssistants[apiIndex];
  }

  const lastApiAssistant = apiAssistants.at(-1);
  if (!lastApiAssistant || lastApiAssistant.id !== apiMessage.id) return undefined;

  const orphanLocals = localMessages.filter(
    (message) => message.role === 'assistant' && !apiIds.has(message.id),
  );
  return orphanLocals.at(-1);
}

function applyPermissionPauseFromTools(message: Message): Message {
  const turnSegments = message.turnSegments?.map((segment) => {
    if (segment.kind === 'tool') {
      return { ...segment, tool: normalizePermissionPausedTool(segment.tool) };
    }
    if (segment.kind === 'tools') {
      return { ...segment, tools: segment.tools.map((tool) => normalizePermissionPausedTool(tool)!) };
    }
    return segment;
  });

  return {
    ...message,
    tool: normalizePermissionPausedTool(message.tool),
    tools: message.tools?.map((tool) => normalizePermissionPausedTool(tool)!),
    turnSegments: turnSegments ?? message.turnSegments,
  };
}

function mergeLocalToolTerminalState(local: ToolPayload, api: ToolPayload): ToolPayload {
  if (local.state === 'rejected') {
    return {
      ...api,
      state: 'rejected',
      rejectedReason: local.rejectedReason ?? api.rejectedReason,
      intervention: { status: 'resolved' },
      error: undefined,
    };
  }
  return api;
}

function mergeLocalToolsOntoMessage(local: Message, merged: Message): Message {
  if (!local.tools?.length || !merged.tools?.length) {
    if (local.tool?.state === 'rejected' && merged.tool) {
      return { ...merged, tool: mergeLocalToolTerminalState(local.tool, merged.tool) };
    }
    return merged;
  }
  const localByCallId = new Map(
    local.tools.map((tool) => [tool.toolCallId ?? tool.id, tool] as const),
  );
  const tools = merged.tools.map((tool) => {
    const key = tool.toolCallId ?? tool.id;
    const peer = key ? localByCallId.get(key) : undefined;
    return peer ? mergeLocalToolTerminalState(peer, tool) : tool;
  });
  return { ...merged, tools };
}

function collectToolsFromTurnSegments(segments: AssistantTurnSegment[]): ToolPayload[] {
  const tools: ToolPayload[] = [];
  for (const segment of segments) {
    if (segment.kind === 'tool') tools.push(segment.tool);
    if (segment.kind === 'tools') tools.push(...segment.tools);
  }
  return tools;
}

function collectLocalTools(message: Message): ToolPayload[] {
  const tools = collectToolsFromTurnSegments(message.turnSegments ?? []);
  if (message.tool) tools.push(message.tool);
  if (message.tools?.length) tools.push(...message.tools);
  return tools;
}

function mergeLocalTurnSegments(local: Message, merged: Message): Message {
  if (!merged.turnSegments?.length) return merged;

  const localByCallId = new Map(
    collectLocalTools(local).map((tool) => [tool.toolCallId ?? tool.id, tool] as const),
  );
  if (localByCallId.size === 0) return merged;

  const turnSegments = merged.turnSegments.map((segment) => {
    if (segment.kind === 'tool') {
      const key = segment.tool.toolCallId ?? segment.tool.id;
      const peer = key ? localByCallId.get(key) : undefined;
      if (peer?.state === 'rejected') {
        return { ...segment, tool: mergeLocalToolTerminalState(peer, segment.tool) };
      }
      return segment;
    }
    if (segment.kind === 'tools') {
      return {
        ...segment,
        tools: segment.tools.map((tool) => {
          const key = tool.toolCallId ?? tool.id;
          const peer = key ? localByCallId.get(key) : undefined;
          return peer?.state === 'rejected' ? mergeLocalToolTerminalState(peer, tool) : tool;
        }),
      };
    }
    return segment;
  });

  return { ...merged, turnSegments };
}

function userMatchKey(message: Message): string {
  return `${message.content.trim()}::${message.createdAt?.slice(0, 16) ?? ''}`;
}

/** API 快照滞后时保留本地 user 气泡，避免 post-stream refresh 清空己方消息。 */
export function preserveMissingLocalUserMessages(merged: Message[], localMessages: Message[]): Message[] {
  if (localMessages.length === 0) return merged;

  const mergedIds = new Set(merged.map((message) => message.id));
  const remoteUserKeys = new Set(
    merged.filter((message) => message.role === 'user').map(userMatchKey),
  );

  const missingUsers = localMessages.filter((message) => {
    if (message.role !== 'user' || !message.content.trim()) return false;
    if (mergedIds.has(message.id)) return false;
    if (remoteUserKeys.has(userMatchKey(message))) return false;
    return true;
  });

  if (missingUsers.length === 0) return merged;

  let result = [...merged];
  for (const user of missingUsers) {
    const localIdx = localMessages.indexOf(user);
    const followingAssistant = localMessages
      .slice(localIdx + 1)
      .find((message) => message.role === 'assistant');

    if (followingAssistant) {
      const targetIdx = result.findIndex((message) => message.id === followingAssistant.id);
      if (targetIdx >= 0) {
        result.splice(targetIdx, 0, user);
        mergedIds.add(user.id);
        continue;
      }
    }

    const lastAssistantIdx = result.reduce(
      (acc, message, index) => (message.role === 'assistant' ? index : acc),
      -1,
    );
    if (lastAssistantIdx >= 0) {
      result.splice(lastAssistantIdx, 0, user);
    } else {
      result.push(user);
    }
    mergedIds.add(user.id);
  }

  return result;
}

/** Preserve streamed assistant blocks when API history omits tool/reasoning fields. */
export function mergeRefreshedMessages(localMessages: Message[], apiMessages: Message[]): Message[] {
  if (localMessages.length === 0) {
    return apiMessages.map((message) =>
      message.role === 'assistant' ? applyPermissionPauseFromTools(message) : message,
    );
  }

  const localById = new Map(localMessages.map((message) => [message.id, message]));
  const apiIds = new Set(apiMessages.map((message) => message.id));

  const merged = apiMessages.map((apiMessage) => {
    if (apiMessage.role !== 'assistant') return apiMessage;

    const local = findLocalAssistantPeer(apiMessage, apiMessages, localMessages, apiIds, localById);
    if (!local) return applyPermissionPauseFromTools(apiMessage);

    const mergedMessage: Message = { ...apiMessage };

    if (messageHasPendingIntervention(local)) {
      if (local.turnSegments?.length) mergedMessage.turnSegments = local.turnSegments;
      if (hasAssistantTools(local)) {
        mergedMessage.tool = local.tool;
        mergedMessage.tools = local.tools;
      }
      return mergedMessage;
    }

    if (!mergedMessage.turnSegments?.length && local.turnSegments?.length) {
      mergedMessage.turnSegments = local.turnSegments;
    } else if (shouldPreferLocalTurnSegments(local, mergedMessage)) {
      mergedMessage.turnSegments = local.turnSegments;
    }

    if (!mergedMessage.content?.trim() && local.content?.trim()) {
      mergedMessage.content = local.content;
    }

    if (!hasAssistantTools(mergedMessage) && hasAssistantTools(local)) {
      mergedMessage.tool = local.tool;
      mergedMessage.tools = local.tools;
    }

    if (!mergedMessage.reasoningBeforeTool && local.reasoningBeforeTool) {
      mergedMessage.reasoningBeforeTool = local.reasoningBeforeTool;
    }

    if (!mergedMessage.reasoningAfterTool && local.reasoningAfterTool) {
      mergedMessage.reasoningAfterTool = local.reasoningAfterTool;
    }

    if (!mergedMessage.grounding && local.grounding) {
      mergedMessage.grounding = local.grounding;
    }

    return applyPermissionPauseFromTools(mergeLocalTurnSegments(local, mergeLocalToolsOntoMessage(local, mergedMessage)));
  });

  const trailingAssistants = localMessages.filter(
    (message) =>
      message.role === 'assistant' &&
      !apiIds.has(message.id) &&
      (Boolean(message.turnSegments?.length) ||
        Boolean(message.content?.trim()) ||
        hasAssistantTools(message)),
  );
  const withTrailingAssistants =
    trailingAssistants.length === 0 ? merged : [...merged, ...trailingAssistants];
  return preserveMissingLocalUserMessages(withTrailingAssistants, localMessages);
}
