import type { Message, PendingIntervention, ToolPayload } from '../domain/types';
import type { StreamingMessage } from '../stores/types';
import type { ActiveRunContext } from '../stores/streamingStore';
import {
  matchesToolReference,
  primaryToolPatchKey,
  isPermissionPauseToolError,
  isToolAwaitingIntervention,
} from '../domain/utils/toolReference';

function collectToolsFromMessage(msg: Message): ToolPayload[] {
  const direct = msg.tools?.length ? msg.tools : msg.tool ? [msg.tool] : [];
  const fromSegments: ToolPayload[] = [];
  for (const segment of msg.turnSegments ?? []) {
    if (segment.kind === 'tool') fromSegments.push(segment.tool);
    if (segment.kind === 'tools') fromSegments.push(...segment.tools);
  }
  return [...direct, ...fromSegments];
}

function pendingFromTool(msg: Message, tool: ToolPayload): PendingIntervention | null {
  if (!isToolAwaitingIntervention(tool)) return null;
  const toolCallId = primaryToolPatchKey(tool);
  const toolMessageId = tool.id ?? toolCallId;
  if (!toolCallId || !toolMessageId) return null;

  return {
    toolCallId,
    toolMessageId,
    assistantMessageId: msg.id,
    apiName: tool.apiName ?? tool.api ?? 'unknown',
    identifier: tool.identifier ?? tool.plugin ?? 'unknown',
    requestArgs: JSON.stringify(tool.params ?? tool.args ?? tool.arguments ?? {}, null, 2),
    permissionId: tool.permissionId,
    hitlKind: tool.hitlKind,
    hitlPrompt: tool.hitlPrompt,
    allowedActions: tool.allowedActions,
    hitlSchema: tool.hitlSchema,
  };
}

/** §C.14 — pending interventions from assistant message tools (incl. turnSegments). */
export function selectPendingInterventions(messages: Message[]): PendingIntervention[] {
  const result: PendingIntervention[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const tool of collectToolsFromMessage(msg)) {
      const pending = pendingFromTool(msg, tool);
      if (!pending || seen.has(pending.toolCallId)) continue;
      seen.add(pending.toolCallId);
      result.push(pending);
    }
  }

  return result;
}

/** Whether an assistant message still has a tool awaiting user approval. */
export function messageHasPendingIntervention(message: Message): boolean {
  if (message.role !== 'assistant') return false;
  return collectToolsFromMessage(message).some((tool) => isToolAwaitingIntervention(tool));
}

/** Pending interventions from the in-flight streaming assistant message. */
export function selectPendingInterventionsFromStreaming(
  streaming: StreamingMessage | null,
): PendingIntervention[] {
  if (!streaming?.segments?.length) return [];

  const pseudoMessage: Message = {
    id: streaming.id,
    role: 'assistant',
    content: streaming.content,
    createdAt: new Date().toISOString(),
    turnSegments: streaming.segments
      .map((segment) => {
        if (segment.kind === 'tool') return { kind: 'tool' as const, id: segment.id, tool: segment.tool };
        if (segment.kind === 'tools') {
          return { kind: 'tools' as const, id: segment.id, tools: segment.tools };
        }
        return null;
      })
      .filter((segment): segment is NonNullable<typeof segment> => segment != null),
  };

  return selectPendingInterventions([pseudoMessage]);
}

function runContextInterventionRefs(
  runContext: Pick<ActiveRunContext, 'permissionId' | 'hitlRequestId' | 'toolCallId'> | null,
): string[] {
  if (!runContext) return [];
  return [runContext.permissionId, runContext.hitlRequestId, runContext.toolCallId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

/** Fallback when run context has permissionId but message state was overwritten by API error. */
export function selectPendingInterventionsFromRunContext(
  messages: Message[],
  runContext: ActiveRunContext | null,
): PendingIntervention[] {
  const refs = runContextInterventionRefs(runContext);
  if (refs.length === 0) return [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== 'assistant') continue;

    for (const tool of collectToolsFromMessage(msg)) {
      if (!refs.some((ref) => matchesToolReference(tool, ref))) continue;
      if (isToolAwaitingIntervention(tool)) {
        const pending = pendingFromTool(msg, tool);
        if (pending) return [pending];
      }
      const permissionPauseError = isPermissionPauseToolError(tool);
      if (
        permissionPauseError &&
        tool.intervention?.status === 'pending' &&
        tool.state === 'error'
      ) {
        const pending = pendingFromTool(msg, {
          ...tool,
          state: 'executing',
          error: undefined,
          resultText: undefined,
          resultContent: undefined,
          permissionId: runContext.permissionId ?? tool.permissionId,
        });
        if (pending) return [pending];
      }
    }
  }

  return [];
}

/** Merge pending interventions from messages, streaming buffer, and run context fallback. */
export function selectAllPendingInterventions(
  messages: Message[],
  streaming: StreamingMessage | null,
  runContext: Pick<ActiveRunContext, 'permissionId' | 'hitlRequestId' | 'toolCallId'> | null,
): PendingIntervention[] {
  const fromMessages = selectPendingInterventions(messages);
  const fromStreaming = selectPendingInterventionsFromStreaming(streaming);
  const seen = new Set<string>();
  const merged: PendingIntervention[] = [];

  for (const item of [...fromMessages, ...fromStreaming]) {
    if (seen.has(item.toolCallId)) continue;
    seen.add(item.toolCallId);
    merged.push(item);
  }

  const activePermissionId = runContext?.permissionId;
  const activeHitlRequestId = runContext?.hitlRequestId;
  const activeToolCallId = runContext?.toolCallId;
  const hasActiveHitlRef = Boolean(activeHitlRequestId || activeToolCallId);
  const matchesActiveRunContext = (item: PendingIntervention): boolean => {
    if (activePermissionId) return item.permissionId === activePermissionId;
    if (hasActiveHitlRef) {
      return item.toolCallId === activeHitlRequestId || item.toolCallId === activeToolCallId;
    }
    return true;
  };

  const contextual = merged.filter(matchesActiveRunContext);
  if (contextual.length > 0) return contextual;
  if (merged.length > 0) {
    if (activePermissionId || hasActiveHitlRef) {
      const freshestPermission = [...merged].reverse().find((item) => item.permissionId)?.permissionId;
      if (freshestPermission && freshestPermission !== activePermissionId) {
        return merged.filter((item) => item.permissionId === freshestPermission);
      }
      return [];
    }
    return merged;
  }

  if (!activePermissionId && !hasActiveHitlRef) return [];

  const candidates: Message[] = [...messages];
  if (streaming?.segments?.length) {
    candidates.push({
      id: streaming.id,
      role: 'assistant',
      content: streaming.content,
      createdAt: new Date().toISOString(),
      turnSegments: streaming.segments
        .map((segment) => {
          if (segment.kind === 'tool') return { kind: 'tool' as const, id: segment.id, tool: segment.tool };
          if (segment.kind === 'tools') {
            return { kind: 'tools' as const, id: segment.id, tools: segment.tools };
          }
          return null;
        })
        .filter((segment): segment is NonNullable<typeof segment> => segment != null),
    });
  }

  return selectPendingInterventionsFromRunContext(candidates, {
    runId: '',
    permissionId: runContext.permissionId,
    hitlRequestId: runContext.hitlRequestId,
    toolCallId: runContext.toolCallId,
  });
}
