import type { StaticReasoningBlock } from '../../domain/types/conversation';
import type { AssistantTurnSegment } from '../../domain/types/assistantTurnSegment';
import type { ToolPayload } from '../../domain/types/tool';
import type { StreamReasoningBlock, StreamTurnSegment } from '../../stores/types';
import { enrichToolPayload } from '../../adapters/consoleDataMode';
import { buildAbandonedToolFeedback } from '../../adapters/api/mappers/toolResultPayload';
import { hasResolvableToolIdentity } from '../../domain/utils/toolDisplayIdentity';
import {
  looksLikePermissionId,
  matchesToolReference,
} from '../../domain/utils/toolReference';
const TRANSIENT_TOOL_TITLES = new Set(['执行中…', '已批准']);

function isTransientToolTitle(title?: string): boolean {
  if (!title?.trim()) return false;
  const trimmed = title.trim();
  if (TRANSIENT_TOOL_TITLES.has(trimmed)) return true;
  return trimmed.startsWith('等待批准：');
}

function resolveCustomTitleAfterMerge(
  existing: ToolPayload | undefined,
  incoming: ToolPayload,
  mergedState: ToolPayload['state'],
  permissionPause: boolean,
): string | undefined {
  if (permissionPause) return existing?.customTitle;
  const candidate = incoming.customTitle ?? existing?.customTitle;
  if (mergedState === 'success' || mergedState === 'rejected') {
    if (isTransientToolTitle(candidate)) {
      return undefined;
    }
    return candidate;
  }
  if (mergedState === 'error') return incoming.customTitle ?? candidate;
  if (isTransientToolTitle(incoming.customTitle)) {
    return isTransientToolTitle(existing?.customTitle) ? undefined : existing?.customTitle;
  }
  return incoming.customTitle ?? existing?.customTitle;
}

export function createStreamReasoningBlock(id: string): StreamReasoningBlock {
  return {
    id,
    text: '',
    thinking: true,
    open: true,
    label: '思考中…',
    startedAt: Date.now(),
  };
}

export function finishStreamReasoningBlock(block: StreamReasoningBlock): StreamReasoningBlock {
  if (!block.thinking) return block;
  const startedAt = block.startedAt ?? Date.now();
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  return {
    ...block,
    thinking: false,
    open: false,
    duration: seconds,
    label: `已深度思考（${seconds}s）`,
  };
}

export function streamReasoningToStatic(block: StreamReasoningBlock): StaticReasoningBlock {
  return {
    id: block.id,
    label: block.label,
    duration: block.duration ?? '0.0',
    thinking: block.thinking,
    open: block.open,
    paragraphs: block.text.trim()
      ? block.text.split(/\n\n+/).filter(Boolean)
      : [''],
  };
}

export function toStaticTurnSegment(segment: StreamTurnSegment): AssistantTurnSegment | null {
  if (segment.kind === 'reasoning') {
    if (!segment.block.text.trim() && !segment.block.thinking) return null;
    return {
      kind: 'reasoning',
      id: segment.id,
      reasoning: streamReasoningToStatic(segment.block),
    };
  }
  if (segment.kind === 'text') {
    if (!segment.text.trim()) return null;
    return { kind: 'text', id: segment.id, text: segment.text };
  }
  if (segment.kind === 'tool') {
    return { kind: 'tool', id: segment.id, tool: segment.tool };
  }
  if (segment.kind === 'tools' && segment.tools.length > 0) {
    return { kind: 'tools', id: segment.id, tools: segment.tools };
  }
  return null;
}

function toolKey(tool: ToolPayload): string {
  return tool.toolCallId ?? tool.id ?? '';
}

function sameToolIdentity(a: ToolPayload, b: ToolPayload): boolean {
  const aApi = a.apiName ?? a.api;
  const bApi = b.apiName ?? b.api;
  if (aApi && bApi && aApi === bApi) {
    const aId = a.identifier ?? a.plugin;
    const bId = b.identifier ?? b.plugin;
    if (!aId || !bId || aId === bId) return true;
  }
  const aLink = a.linkloomToolId;
  const bLink = b.linkloomToolId;
  return Boolean(aLink && bLink && aLink === bLink);
}

function hasDistinctToolCallIds(a: ToolPayload, b: ToolPayload): boolean {
  const aKey = toolKey(a);
  const bKey = toolKey(b);
  return Boolean(
    aKey &&
      bKey &&
      aKey !== bKey &&
      !looksLikePermissionId(aKey) &&
      !looksLikePermissionId(bKey),
  );
}

function sharesToolReference(a: ToolPayload, b: ToolPayload): boolean {
  const aKey = toolKey(a);
  const bKey = toolKey(b);
  if (aKey && bKey && aKey === bKey) return true;
  if (aKey && bKey && matchesToolReference(a, bKey)) return true;
  if (aKey && bKey && matchesToolReference(b, aKey)) return true;
  if (a.permissionId && b.permissionId && a.permissionId === b.permissionId) return true;
  return false;
}

function findInFlightToolSegmentIndex(
  segments: StreamTurnSegment[],
  incoming: ToolPayload,
): { segmentIndex: number; toolIndex?: number } | null {
  const key = toolKey(incoming);
  if (key) {
    const located = findToolSegmentIndex(segments, key);
    if (located) return located;
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]!;
    if (
      segment.kind === 'tool' &&
      isToolInFlight(segment.tool) &&
      sameToolIdentity(segment.tool, incoming) &&
      !hasDistinctToolCallIds(segment.tool, incoming)
    ) {
      return { segmentIndex: i };
    }
    if (segment.kind === 'tools') {
      for (let toolIndex = segment.tools.length - 1; toolIndex >= 0; toolIndex--) {
        const tool = segment.tools[toolIndex]!;
        if (
          isToolInFlight(tool) &&
          sameToolIdentity(tool, incoming) &&
          !hasDistinctToolCallIds(tool, incoming)
        ) {
          return { segmentIndex: i, toolIndex };
        }
      }
    }
  }

  return null;
}

function isToolInFlight(tool: ToolPayload): boolean {
  return tool.state === 'executing' || tool.state === 'pending';
}

function matchesToolKey(tool: ToolPayload, key: string): boolean {
  return matchesToolReference(tool, key);
}

function findToolSegmentIndex(
  segments: StreamTurnSegment[],
  toolCallId: string,
): { segmentIndex: number; toolIndex?: number } | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]!;
    if (segment.kind === 'tool' && matchesToolKey(segment.tool, toolCallId)) {
      return { segmentIndex: i };
    }
    if (segment.kind === 'tools') {
      const toolIndex = segment.tools.findIndex((tool) => matchesToolKey(tool, toolCallId));
      if (toolIndex >= 0) return { segmentIndex: i, toolIndex };
    }
  }
  return null;
}

export function finishOpenReasoningSegments(segments: StreamTurnSegment[]): StreamTurnSegment[] {
  return segments.map((segment) =>
    segment.kind === 'reasoning' && segment.block.thinking
      ? { ...segment, block: finishStreamReasoningBlock(segment.block) }
      : segment,
  );
}

export function countReasoningSegments(segments: StreamTurnSegment[]): number {
  return segments.filter((segment) => segment.kind === 'reasoning').length;
}

export function hasReasoningBeforeTools(segments: StreamTurnSegment[]): boolean {
  const firstToolIdx = segments.findIndex((segment) => segment.kind === 'tool' || segment.kind === 'tools');
  if (firstToolIdx < 0) return segments.some((segment) => segment.kind === 'reasoning');
  return segments.slice(0, firstToolIdx).some((segment) => segment.kind === 'reasoning');
}

function findLastToolSegmentIndex(segments: StreamTurnSegment[]): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]!;
    if (segment.kind === 'tool' || segment.kind === 'tools') return i;
  }
  return -1;
}

export function appendReasoningChunk(
  segments: StreamTurnSegment[],
  chunk: string,
  options?: { nextReasoningIndex?: number; block?: 1 | 2 },
): StreamTurnSegment[] {
  const block = options?.block;
  const next = [...segments];
  const last = next.at(-1);
  if (last?.kind === 'reasoning' && last.block.thinking) {
    next[next.length - 1] = {
      ...last,
      block: {
        ...last.block,
        text: last.block.text + chunk,
        thinking: true,
        open: true,
        label: '思考中…',
      },
    };
    return next;
  }

  const firstToolIdx = next.findIndex((segment) => segment.kind === 'tool' || segment.kind === 'tools');
  const reasoningBeforeTools = hasReasoningBeforeTools(next);
  const lastToolIdx = findLastToolSegmentIndex(next);

  // Pre-tool reasoning that arrives after tool_call_requested (out-of-order SSE)
  // must render above the tool block it belongs to, not appended after it.
  if (
    block === 1 &&
    chunk &&
    lastToolIdx >= 0 &&
    (last?.kind === 'tool' || last?.kind === 'tools')
  ) {
    const id = `stream-reasoning-${options?.nextReasoningIndex ?? countReasoningSegments(segments) + 1}`;
    const inserted: StreamTurnSegment = {
      kind: 'reasoning',
      id,
      block: {
        ...createStreamReasoningBlock(id),
        text: chunk,
      },
    };
    return [...next.slice(0, lastToolIdx), inserted, ...next.slice(lastToolIdx)];
  }

  // First reasoning of the turn arrived after the first tool block (replay snapshot).
  if (block === 1 && firstToolIdx >= 0 && !reasoningBeforeTools) {
    const id = `stream-reasoning-${options?.nextReasoningIndex ?? countReasoningSegments(segments) + 1}`;
    const inserted: StreamTurnSegment = {
      kind: 'reasoning',
      id,
      block: {
        ...createStreamReasoningBlock(id),
        text: chunk,
      },
    };
    return [...next.slice(0, firstToolIdx), inserted, ...next.slice(firstToolIdx)];
  }

  const id = `stream-reasoning-${options?.nextReasoningIndex ?? countReasoningSegments(segments) + 1}`;
  let settled = finishOpenReasoningSegments(segments);
  settled = settleStaleApprovedExecutingTools(settled);
  settled.push({
    kind: 'reasoning',
    id,
    block: {
      ...createStreamReasoningBlock(id),
      text: chunk,
    },
  });
  return settled;
}

/** Append an assistant answer text chunk in arrival order so it interleaves
 *  with reasoning/tool segments. Closes any open reasoning segment first and
 *  settles stale approved-but-in-flight tools so the new text block reflects
 *  the post-tool answer phase. Consecutive chunks merge into the last text
 *  segment to avoid one block per token. */
export function appendTextChunk(
  segments: StreamTurnSegment[],
  chunk: string,
  nextTextIndex?: number,
): StreamTurnSegment[] {
  if (!chunk) return segments;
  const next = [...segments];
  const last = next.at(-1);
  if (last?.kind === 'text') {
    next[next.length - 1] = { ...last, text: last.text + chunk };
    return next;
  }

  let settled = finishOpenReasoningSegments(segments);
  settled = settleStaleApprovedExecutingTools(settled);
  // Only count text segments when we actually need to mint a new id — avoids
  // an O(n) filter scan on every streamed token when the trailing segment is
  // already a text segment (the common hot path).
  const index = nextTextIndex ?? countTextSegments(settled) + 1;
  settled.push({
    kind: 'text',
    id: `stream-text-${index}`,
    text: chunk,
  });
  return settled;
}

export function countTextSegments(segments: StreamTurnSegment[]): number {
  return segments.filter((segment) => segment.kind === 'text').length;
}

export function normalizeToolSegments(segments: StreamTurnSegment[]): StreamTurnSegment[] {
  const next: StreamTurnSegment[] = [];

  for (const segment of segments) {
    if (segment.kind === 'tool') {
      if (!hasResolvableToolIdentity(segment.tool)) continue;
      next.push(segment);
      continue;
    }

    if (segment.kind === 'tools') {
      const tools = segment.tools.filter(hasResolvableToolIdentity);
      if (tools.length === 0) continue;
      if (tools.length === 1) {
        next.push({ kind: 'tool', id: segment.id, tool: tools[0]! });
        continue;
      }
      next.push({ ...segment, tools });
    } else {
      next.push(segment);
    }
  }

  return next;
}

export function fromStaticTurnSegments(segments?: AssistantTurnSegment[]): StreamTurnSegment[] {
  if (!segments?.length) return [];
  return segments.flatMap((segment): StreamTurnSegment[] => {
    if (segment.kind === 'reasoning') {
      const reasoning = segment.reasoning;
      return [
        {
          kind: 'reasoning',
          id: segment.id,
          block: {
            id: reasoning.id,
            text: reasoning.paragraphs?.join('\n\n') ?? '',
            thinking: reasoning.thinking ?? false,
            open: reasoning.open ?? false,
            label: reasoning.label,
            duration: reasoning.duration,
          },
        },
      ];
    }
    if (segment.kind === 'text') {
      return [{ kind: 'text', id: segment.id, text: segment.text }];
    }
    if (segment.kind === 'tool') {
      return [{ kind: 'tool', id: segment.id, tool: segment.tool }];
    }
    if (segment.kind === 'tools') {
      return [{ kind: 'tools', id: segment.id, tools: segment.tools }];
    }
    return [];
  });
}

function isPermissionPauseToolUpdate(
  existing: ToolPayload | undefined,
  incoming: ToolPayload,
): boolean {
  if (incoming.state === 'rejected') return false;
  if (incoming.intervention?.status === 'resolved') return false;
  if (existing?.intervention?.status === 'resolved') return false;
  if (existing?.intervention?.status === 'pending') return true;
  if (incoming.intervention?.status === 'pending') return true;
  const errorText = `${incoming.error ?? incoming.resultText ?? ''}`.toLowerCase();
  return incoming.state === 'error' && errorText.includes('permission required');
}

function hasToolResult(tool: ToolPayload): boolean {
  if (tool.resultText?.trim()) return true;
  if (tool.resultContent?.trim()) return true;
  if (tool.pluginState != null) return true;
  return false;
}

function shouldSettleAbandonedTool(tool: ToolPayload, incoming: ToolPayload): boolean {
  const incomingKey = toolKey(incoming);
  const key = toolKey(tool);
  // Only skip the exact same tool call — same apiName must still settle (e.g. two runCommand rounds).
  if (key && incomingKey && key === incomingKey) return false;
  if (tool.state === 'success' || tool.state === 'rejected' || tool.state === 'error') return false;
  // Approved tools are still executing on the backend — wait for tool_finished.
  if (tool.state === 'executing' && tool.intervention?.status === 'resolved') return false;
  // Parallel tool_call_requested events bundle into one group — do not mark siblings as abandoned.
  if (isToolInFlight(incoming) && isToolInFlight(tool)) return false;
  return isToolInFlight(tool);
}

function finalizeAbandonedTool(tool: ToolPayload): ToolPayload {
  if (tool.state === 'success' && hasToolResult(tool)) {
    return tool;
  }
  if (tool.state === 'executing' && tool.intervention?.status === 'resolved') {
    if (hasToolResult(tool)) {
      return enrichToolPayload({
        ...tool,
        state: 'success',
        customTitle: undefined,
        error: undefined,
      });
    }
    return enrichToolPayload({
      ...tool,
      state: 'error',
      intervention: { status: 'resolved' },
      customTitle: undefined,
      ...buildAbandonedToolFeedback(tool),
    });
  }
  return enrichToolPayload({
    ...tool,
    state: 'error',
    error: tool.error ?? '未完成',
    intervention: { status: 'resolved' },
    customTitle: undefined,
  });
}

function settleStaleApprovedExecutingTools(segments: StreamTurnSegment[]): StreamTurnSegment[] {
  if (segments.length === 0) return segments;
  const lastIdx = segments.length - 1;
  const last = segments[lastIdx]!;

  if (last.kind === 'tool') {
    const tool = last.tool;
    if (
      tool.state === 'executing' &&
      tool.intervention?.status === 'resolved' &&
      !hasToolResult(tool)
    ) {
      const copy = [...segments];
      copy[lastIdx] = { ...last, tool: finalizeAbandonedTool(tool) };
      return copy;
    }
    return segments;
  }

  if (last.kind === 'tools') {
    const tools = [...last.tools];
    let changed = false;
    for (let i = tools.length - 1; i >= 0; i--) {
      const tool = tools[i]!;
      if (
        tool.state === 'executing' &&
        tool.intervention?.status === 'resolved' &&
        !hasToolResult(tool)
      ) {
        tools[i] = finalizeAbandonedTool(tool);
        changed = true;
        break;
      }
      if (isToolInFlight(tool)) break;
    }
    if (!changed) return segments;
    const copy = [...segments];
    copy[lastIdx] = { ...last, tools };
    return copy;
  }

  return segments;
}

function settleAbandonedInFlightTools(
  segments: StreamTurnSegment[],
  incoming: ToolPayload,
): StreamTurnSegment[] {
  if (!isToolInFlight(incoming) && incoming.state !== 'executing') return segments;

  return segments.map((segment) => {
    if (segment.kind === 'tool') {
      if (shouldSettleAbandonedTool(segment.tool, incoming)) {
        return {
          ...segment,
          tool: finalizeAbandonedTool(segment.tool),
        };
      }
      return segment;
    }
    if (segment.kind === 'tools') {
      const tools = segment.tools.map((tool) => {
        if (shouldSettleAbandonedTool(tool, incoming)) {
          return finalizeAbandonedTool(tool);
        }
        return tool;
      });
      return { ...segment, tools };
    }
    return segment;
  });
}

/** permission_resolved carries only approval state — must merge, never append as a new tool row. */
function isPermissionResolvedStub(tool: ToolPayload): boolean {
  if (tool.intervention?.status !== 'resolved') return false;
  if (
    tool.apiName?.trim() ||
    tool.api?.trim() ||
    tool.identifier?.trim() ||
    tool.plugin?.trim()
  ) {
    return false;
  }
  return tool.state === 'executing' || tool.state === 'success' || tool.state === 'rejected';
}

function locateToolSegmentForUpdate(
  segments: StreamTurnSegment[],
  tool: ToolPayload,
): { segmentIndex: number; toolIndex?: number } | null {
  const key = toolKey(tool);
  if (key) {
    const byKey = findToolSegmentIndex(segments, key);
    if (byKey) return byKey;
  }
  if (tool.permissionId) {
    const byPermission = findToolSegmentIndex(segments, tool.permissionId);
    if (byPermission) return byPermission;
  }
  return findInFlightToolSegmentIndex(segments, tool);
}

function mergePermissionResolvedStub(
  existing: ToolPayload,
  incoming: ToolPayload,
): ToolPayload {
  const rejected = incoming.state === 'rejected';
  return enrichToolPayload({
    ...existing,
    id: existing.id ?? incoming.id,
    toolCallId: existing.toolCallId ?? incoming.toolCallId,
    permissionId: incoming.permissionId ?? existing.permissionId,
    identifier: existing.identifier ?? incoming.identifier,
    apiName: existing.apiName ?? incoming.apiName,
    api: existing.api ?? existing.apiName ?? incoming.api,
    plugin: existing.plugin ?? existing.identifier,
    params: existing.params ?? existing.arguments,
    arguments: existing.arguments ?? existing.params,
    intervention: { status: 'resolved' },
    state: rejected ? 'rejected' : 'executing',
    customTitle: isTransientToolTitle(existing.customTitle) ? undefined : existing.customTitle,
    rejectedReason: incoming.rejectedReason ?? existing.rejectedReason,
    error: undefined,
    resultText: existing.resultText,
    resultContent: existing.resultContent,
  });
}

export function settleUnresolvedToolsOnTurnEnd(segments: StreamTurnSegment[]): StreamTurnSegment[] {
  const settleTool = (tool: ToolPayload): ToolPayload => {
    if (tool.state === 'rejected' || tool.rejectedReason) return tool;
    if (tool.state !== 'executing' || tool.intervention?.status !== 'resolved') return tool;
    return finalizeAbandonedTool(tool);
  };

  return segments.map((segment) => {
    if (segment.kind === 'tool') {
      const tool = settleTool(segment.tool);
      return tool === segment.tool ? segment : { ...segment, tool };
    }
    if (segment.kind === 'tools') {
      const tools = segment.tools.map(settleTool);
      return tools.every((tool, index) => tool === segment.tools[index])
        ? segment
        : { ...segment, tools };
    }
    return segment;
  });
}

function resolveMergedIntervention(
  existing: ToolPayload,
  incoming: ToolPayload,
  permissionPause: boolean,
  terminalState: boolean,
): NonNullable<ToolPayload['intervention']> {
  if (terminalState) return { status: 'resolved' };
  if (incoming.intervention?.status === 'pending') return incoming.intervention;
  if (permissionPause) {
    return existing.intervention?.status === 'pending'
      ? existing.intervention
      : { status: 'pending' };
  }
  return incoming.intervention ?? existing.intervention ?? { status: 'resolved' };
}

function buildMergedToolPayload(existing: ToolPayload, incoming: ToolPayload): ToolPayload {
  const permissionPause = isPermissionPauseToolUpdate(existing, incoming);
  const terminalState =
    incoming.state === 'success' ||
    incoming.state === 'rejected' ||
    (incoming.state === 'error' && !permissionPause);
  const incomingPermissionId =
    incoming.permissionId ??
    (looksLikePermissionId(incoming.toolCallId) ? incoming.toolCallId : undefined);
  const preservedCallId =
    existing.toolCallId && !looksLikePermissionId(existing.toolCallId)
      ? existing.toolCallId
      : incoming.toolCallId && !looksLikePermissionId(incoming.toolCallId)
        ? incoming.toolCallId
        : existing.toolCallId ?? incoming.toolCallId;
  const preservedId =
    existing.id && !looksLikePermissionId(existing.id)
      ? existing.id
      : preservedCallId ?? existing.id ?? incoming.id;
  const nextState = permissionPause ? 'pending' : (incoming.state ?? existing.state);

  return enrichToolPayload({
    ...existing,
    ...incoming,
    id: preservedId,
    toolCallId: preservedCallId,
    permissionId: incomingPermissionId ?? existing.permissionId,
    identifier: incoming.identifier ?? existing.identifier,
    apiName: incoming.apiName ?? existing.apiName,
    api: incoming.api ?? incoming.apiName ?? existing.api ?? existing.apiName,
    plugin: incoming.plugin ?? existing.plugin ?? existing.identifier,
    params: incoming.params ?? incoming.arguments ?? existing.params ?? existing.arguments,
    arguments: incoming.arguments ?? existing.arguments,
    duration: incoming.duration ?? existing.duration,
    resultText: permissionPause ? existing.resultText : (incoming.resultText ?? existing.resultText),
    resultContent: permissionPause
      ? existing.resultContent
      : (incoming.resultContent ?? existing.resultContent),
    pluginState: incoming.pluginState ?? existing.pluginState,
    intervention: resolveMergedIntervention(existing, incoming, permissionPause, terminalState),
    state: nextState,
    customTitle: resolveCustomTitleAfterMerge(existing, incoming, nextState, permissionPause),
    error: permissionPause ? existing.error : incoming.error ?? existing.error,
  });
}

function shouldApplyPermissionResolved(existing: ToolPayload, incoming: ToolPayload): boolean {
  if (!isPermissionResolvedStub(incoming)) return false;
  if (
    existing.intervention?.status === 'pending' &&
    (existing.state === 'pending' || existing.state === 'executing')
  ) {
    return true;
  }
  if (existing.state === 'error') return false;
  if (existing.state === 'success' && Boolean(existing.resultText || existing.resultContent)) {
    return false;
  }
  if (existing.state === 'executing' && existing.intervention?.status === 'resolved') {
    return true;
  }
  if (existing.state === 'success' && !existing.resultText && !existing.resultContent) {
    return true;
  }
  return false;
}

function mergeToolPayload(existing: ToolPayload | undefined, incoming: ToolPayload): ToolPayload {
  if (existing?.state === 'rejected') {
    return existing;
  }

  if (existing && shouldApplyPermissionResolved(existing, incoming)) {
    return mergePermissionResolvedStub(existing, incoming);
  }

  if (!existing) {
    if (isPermissionPauseToolUpdate(undefined, incoming)) {
      return enrichToolPayload({
        ...incoming,
        state: 'pending',
        error: undefined,
        intervention: incoming.intervention ?? { status: 'pending' },
      });
    }
    return incoming;
  }

  if (
    existing.intervention?.status === 'resolved' &&
    incoming.intervention?.status === 'pending' &&
    sharesToolReference(existing, incoming)
  ) {
    return existing;
  }

  return buildMergedToolPayload(existing, incoming);
}

function mergeToolSegmentAt(
  segments: StreamTurnSegment[],
  located: { segmentIndex: number; toolIndex?: number },
  incoming: ToolPayload,
): StreamTurnSegment[] {
  const segment = segments[located.segmentIndex]!;
  const copy = [...segments];
  if (segment.kind === 'tool') {
    copy[located.segmentIndex] = {
      ...segment,
      tool: mergeToolPayload(segment.tool, incoming),
    };
    return normalizeToolSegments(copy);
  }
  if (segment.kind === 'tools' && located.toolIndex !== undefined) {
    const tools = [...segment.tools];
    tools[located.toolIndex] = mergeToolPayload(tools[located.toolIndex]!, incoming);
    copy[located.segmentIndex] = { ...segment, tools };
    return normalizeToolSegments(copy);
  }
  return segments;
}

export function upsertToolSegments(
  segments: StreamTurnSegment[],
  mapped: ToolPayload[],
  nextToolBatchIndex: number,
): StreamTurnSegment[] {
  let next = finishOpenReasoningSegments(segments);
  const stubs = mapped.filter(isPermissionResolvedStub);
  const resolved = mapped.filter(
    (tool) => hasResolvableToolIdentity(tool) && !isPermissionResolvedStub(tool),
  );

  for (const stub of stubs) {
    const located = locateToolSegmentForUpdate(next, stub);
    if (located) {
      next = mergeToolSegmentAt(next, located, stub);
      continue;
    }
  }

  if (resolved.length === 0) {
    const orphan = mapped.find((tool) => !isPermissionResolvedStub(tool));
    if (!orphan) return normalizeToolSegments(next);
    const located = locateToolSegmentForUpdate(next, orphan);
    if (!located) return normalizeToolSegments(next);
    return mergeToolSegmentAt(next, located, orphan);
  }

  if (resolved.length > 1) {
    return normalizeToolSegments([
      ...next,
      {
        kind: 'tools',
        id: `stream-tools-${nextToolBatchIndex}`,
        tools: resolved,
      },
    ]);
  }

  const incoming = resolved[0]!;
  const key = toolKey(incoming);
  const located = locateToolSegmentForUpdate(next, incoming);
  if (located) {
    return mergeToolSegmentAt(next, located, incoming);
  }

  if (!hasResolvableToolIdentity(incoming)) {
    return normalizeToolSegments(next);
  }

  const executing = isToolInFlight(incoming);
  const last = next.at(-1);
  const sameAsLastInFlight =
    last?.kind === 'tool' &&
    isToolInFlight(last.tool) &&
    !hasDistinctToolCallIds(last.tool, incoming) &&
    (toolKey(last.tool) === key || sameToolIdentity(last.tool, incoming));
  if (executing && last?.kind === 'tool' && isToolInFlight(last.tool) && !sameAsLastInFlight) {
    const settledPrior = shouldSettleAbandonedTool(last.tool, incoming)
      ? finalizeAbandonedTool(last.tool)
      : last.tool;
    return normalizeToolSegments([
      ...next.slice(0, -1),
      {
        kind: 'tools',
        id: last.id,
        tools: [settledPrior, incoming],
      },
    ]);
  }
  if (executing && last?.kind === 'tools' && last.tools.some((tool) => isToolInFlight(tool))) {
    const settledTools = last.tools.map((tool) =>
      shouldSettleAbandonedTool(tool, incoming) ? finalizeAbandonedTool(tool) : tool,
    );
    const copy = [...next];
    copy[copy.length - 1] = { ...last, tools: [...settledTools, incoming] };
    return normalizeToolSegments(copy);
  }

  next = settleAbandonedInFlightTools(next, incoming);

  return normalizeToolSegments([
    ...next,
    {
      kind: 'tool',
      id: key || `stream-tool-${nextToolBatchIndex}`,
      tool: incoming,
    },
  ]);
}

export function countToolBatchSegments(segments: StreamTurnSegment[]): number {
  return segments.filter((segment) => segment.kind === 'tool' || segment.kind === 'tools').length;
}
