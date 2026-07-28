import type { AssistantContentBlock, Message } from '../../../domain/types';
import type { AssistantTurnSegment } from '../../../domain/types/assistantTurnSegment';
import type { StaticReasoningBlock } from '../../../domain/types/conversation';
import type { StreamingMessage, StreamReasoningBlock } from '../../../stores/types';
import { streamReasoningToStatic } from '../../../services/streaming/streamSegments';

function blocksFromTurnSegments(
  _messageId: string,
  segments: AssistantTurnSegment[],
): AssistantContentBlock[] {
  const blocks: AssistantContentBlock[] = [];
  for (const segment of segments) {
    if (segment.kind === 'reasoning') {
      blocks.push({ id: segment.id, reasoning: segment.reasoning });
    } else if (segment.kind === 'text') {
      blocks.push({ id: segment.id, content: segment.text });
    } else if (segment.kind === 'tool') {
      blocks.push({ id: segment.id, tools: [segment.tool] });
    } else if (segment.kind === 'tools') {
      blocks.push({ id: segment.id, tools: segment.tools });
    }
  }
  return blocks;
}

function blocksFromLegacyMessage(
  source: Pick<
    Message,
    | 'id'
    | 'content'
    | 'grounding'
    | 'tool'
    | 'tools'
    | 'reasoningBeforeTool'
    | 'reasoningAfterTool'
    | 'images'
  >,
): AssistantContentBlock[] {
  const blocks: AssistantContentBlock[] = [];

  if (source.grounding) {
    blocks.push({ id: `${source.id}-grounding`, grounding: source.grounding });
  }
  if (source.reasoningBeforeTool) {
    blocks.push({ id: `${source.id}-reasoning-1`, reasoning: source.reasoningBeforeTool });
  }
  const toolList = source.tools?.length ? source.tools : source.tool ? [source.tool] : undefined;
  if (toolList?.length) {
    blocks.push({ id: `${source.id}-workflow`, tools: toolList, content: '' });
  }
  if (source.reasoningAfterTool) {
    blocks.push({ id: `${source.id}-reasoning-2`, reasoning: source.reasoningAfterTool });
  }
  if (source.content?.trim()) {
    blocks.push({
      id: `${source.id}-answer`,
      content: source.content,
      images: source.images,
    });
  } else if (source.images?.length) {
    blocks.push({ id: `${source.id}-images`, images: source.images });
  }

  return blocks;
}

function appendAnswerBlock(
  blocks: AssistantContentBlock[],
  source: Pick<Message, 'id' | 'content' | 'images'>,
): void {
  if (source.content?.trim()) {
    blocks.push({
      id: `${source.id}-answer`,
      content: source.content,
      images: source.images,
    });
    return;
  }
  if (source.images?.length) {
    blocks.push({ id: `${source.id}-images`, images: source.images });
  }
}

/** Map flat Message / stream state into ordered blocks (one reasoning or tool group per block). */
export function messageToAssistantBlocks(
  source: Pick<
    Message,
    | 'id'
    | 'content'
    | 'grounding'
    | 'tool'
    | 'tools'
    | 'reasoningBeforeTool'
    | 'reasoningAfterTool'
    | 'turnSegments'
    | 'images'
  >,
): AssistantContentBlock[] {
  const blocks: AssistantContentBlock[] = [];

  if (source.grounding) {
    blocks.push({ id: `${source.id}-grounding`, grounding: source.grounding });
  }

  if (source.turnSegments?.length) {
    blocks.push(...blocksFromTurnSegments(source.id, source.turnSegments));
    // Legacy persisted turns may only carry reasoning/tool segments with the
    // answer text living in `content`. Only append a trailing answer block when
    // the segments did not already include interleaved text blocks.
    const hasTextSegment = source.turnSegments.some((segment) => segment.kind === 'text');
    if (!hasTextSegment) {
      appendAnswerBlock(blocks, source);
    }
    return blocks;
  }

  blocks.push(...blocksFromLegacyMessage(source).filter((block) => !block.grounding));
  return blocks;
}

function streamingReasoningToStatic(block: StreamReasoningBlock): StaticReasoningBlock | undefined {
  if (!block.text.trim() && !block.thinking) return undefined;
  return streamReasoningToStatic(block);
}

export function streamingMessageToBlocks(message: StreamingMessage): AssistantContentBlock[] {
  const blocks: AssistantContentBlock[] = [];

  if (message.grounding) {
    blocks.push({ id: `${message.id}-grounding`, grounding: message.grounding });
  }

  for (const segment of message.segments ?? []) {
    if (segment.kind === 'reasoning') {
      const reasoning = streamingReasoningToStatic(segment.block);
      if (reasoning) blocks.push({ id: segment.id, reasoning });
      continue;
    }
    if (segment.kind === 'text') {
      if (segment.text.trim()) {
        blocks.push({ id: segment.id, content: segment.text });
      }
      continue;
    }
    if (segment.kind === 'tool') {
      blocks.push({ id: segment.id, tools: [segment.tool] });
      continue;
    }
    if (segment.kind === 'tools') {
      blocks.push({ id: segment.id, tools: segment.tools });
    }
  }

  if (!message.segments?.length) {
    return messageToAssistantBlocks({
      id: message.id,
      content: message.content,
      grounding: message.grounding,
      tool: message.tool,
      tools: message.tools,
      reasoningBeforeTool: undefined,
      reasoningAfterTool: undefined,
      images: message.images,
    });
  }

  // If the stream already interleaved text blocks into segments, the trailing
  // answer block is redundant. Only fall back to `appendAnswerBlock` when no
  // text segment was emitted yet (e.g. mock mode or legacy fixtures that still
  // accumulate into `message.content`).
  const hasTextSegment = (message.segments ?? []).some((segment) => segment.kind === 'text');
  if (!hasTextSegment) {
    appendAnswerBlock(blocks, message);
  }
  return blocks;
}
