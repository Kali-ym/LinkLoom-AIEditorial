import type { StaticReasoningBlock } from '../../domain/types/conversation';
import type { GroundingData } from '../../domain/types/grounding';
import type { ToolPayload } from '../../domain/types/tool';
import type { StreamEvent } from './streamEvent';
import type { StreamingMessage } from '../../stores/types';
import { enrichToolPayload } from '../../adapters/consoleDataMode';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import {
  appendReasoningChunk,
  appendTextChunk,
  countToolBatchSegments,
  finishOpenReasoningSegments,
  finishStreamReasoningBlock,
  settleUnresolvedToolsOnTurnEnd,
  toStaticTurnSegment,
  upsertToolSegments,
} from './streamSegments';

export interface StreamTimingMeta {
  r1Started: number | null;
  r2Started: number | null;
}

export function createStreamTimingMeta(): StreamTimingMeta {
  return { r1Started: null, r2Started: null };
}

function isApiMappedTool(tool: ToolPayload): boolean {
  return Boolean(
    tool.identifier ||
      tool.apiName ||
      tool.api ||
      tool.toolCallId ||
      tool.hitlKind,
  );
}

function isApiStreamMode(): boolean {
  return isAgentConsoleApiMode();
}

function normalizeApiToolPayload(tool: ToolPayload): ToolPayload {
  return enrichToolPayload({
    ...tool,
    identifier: tool.identifier ?? tool.plugin,
    apiName: tool.apiName ?? tool.api,
    api: tool.api ?? tool.apiName,
    plugin: tool.plugin ?? tool.identifier,
    params: tool.params ?? tool.arguments,
    arguments: tool.arguments ?? tool.params,
  });
}

function toolPayloadFromEvent(tool: ToolPayload, userText: string): ToolPayload {
  if (isApiStreamMode()) {
    return normalizeApiToolPayload(tool);
  }

  if (tool.hitlKind || isApiMappedTool(tool)) {
    return normalizeApiToolPayload(tool);
  }

  const url = tool.url ?? userText.match(/https?:\/\/\S+/)?.[0] ?? 'https://docs.example.com/changelog';
  return enrichToolPayload({
    ...tool,
    customTitle: tool.customTitle ?? `读取页面内容：${url}`,
    plugin: tool.plugin ?? 'web-browsing',
    api: tool.api ?? 'fetchPage',
    params: tool.params ?? { url },
    resultText:
      tool.resultText ??
      (tool.state === 'executing'
        ? '正在抓取页面…'
        : '页面已抓取，包含 v2.x 组件更新、@lobehub/ui 新 API 等条目。'),
  });
}

export interface StreamReduceResult {
  message: StreamingMessage;
  meta: StreamTimingMeta;
  tokenDelta: number;
}

/** Apply one SSE-style event to the in-flight streaming message (mirrors index.html processNext). */
export function reduceStreamEvent(
  message: StreamingMessage,
  event: StreamEvent,
  meta: StreamTimingMeta,
  userText = '',
): StreamReduceResult {
  let next: StreamingMessage = { ...message, segments: [...(message.segments ?? [])] };
  let nextMeta = { ...meta };
  let tokenDelta = 0;

  switch (event.type) {
    case 'reasoning_part': {
      const chunk = event.content ?? event.text ?? '';
      tokenDelta = chunk.length;
      if (chunk.length > 0 && !nextMeta.r1Started) {
        nextMeta.r1Started = Date.now();
      }
      next.segments = appendReasoningChunk(next.segments ?? [], chunk, { block: event.block });
      break;
    }

    case 'reasoning':
      break;

    case 'grounding':
      if (event.data && !('runId' in event.data) && !('fallback' in event.data)) {
        next.grounding = event.data;
      }
      break;

    case 'hitl_context':
      break;

    case 'tool_calls': {
      const tools = event.tools;
      if (!tools?.length) break;
      const mapped = tools.map((t) => toolPayloadFromEvent(t, userText));
      const batchIndex = countToolBatchSegments(next.segments ?? []) + 1;
      next.segments = upsertToolSegments(next.segments ?? [], mapped, batchIndex);
      break;
    }

    case 'content_part': {
      const chunk = event.text ?? event.content ?? '';
      tokenDelta = chunk.length;
      if (chunk) {
        // Avoid an O(n) `countTextSegments` scan on every chunk: appendTextChunk
        // merges into the trailing text segment without needing an index, and
        // only computes the index when it has to create a new segment.
        next.segments = appendTextChunk(next.segments ?? [], chunk);
        next.content = next.content + chunk;
      }
      break;
    }

    case 'turn_failed': {
      const chunk = event.text ?? event.content ?? 'Agent 运行失败';
      tokenDelta = chunk.length;
      next.content = next.content ? `${next.content}\n\n${chunk}` : chunk;
      next.segments = settleUnresolvedToolsOnTurnEnd(next.segments ?? []);
      next.streaming = false;
      next.stopped = true;
      break;
    }

    case 'text': {
      const chunk = event.text ?? event.content ?? '';
      tokenDelta = chunk.length;
      if (chunk) {
        next.segments = appendTextChunk(next.segments ?? [], chunk);
        next.content = next.content + chunk;
      }
      break;
    }

    case 'base64_image': {
      const src =
        event.content ??
        `data:image/svg+xml,${encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="#f0f4f8" width="320" height="180" rx="8"/><text x="160" y="90" text-anchor="middle" fill="#6b7280" font-family="system-ui" font-size="13">生成图片</text></svg>',
        )}`;
      next.images = [...(next.images ?? []), { src, alt: event.alt ?? '生成图片' }];
      break;
    }

    case 'stop':
      next.segments = finishOpenReasoningSegments(next.segments ?? []);
      next.streaming = false;
      break;

    default:
      break;
  }

  return { message: next, meta: nextMeta, tokenDelta };
}

/** Convert streaming reasoning block to static shape for finalized messages. */
export function toStaticReasoningBlock(block: {
  id: string;
  text: string;
  thinking: boolean;
  open: boolean;
  label: string;
  duration?: string;
} | undefined): StaticReasoningBlock | undefined {
  if (!block || !block.text.trim()) return undefined;
  return {
    id: block.id,
    label: block.label,
    duration: block.duration ?? '0.0',
    thinking: block.thinking,
    open: block.open,
    paragraphs: block.text.split(/\n\n+/).filter(Boolean),
  };
}

export { finishStreamReasoningBlock, toStaticTurnSegment };

export type { GroundingData, ToolPayload };
