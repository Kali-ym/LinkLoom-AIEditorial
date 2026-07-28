import type { AssistantTurnSegment } from '../../../domain/types/assistantTurnSegment';
import type { Message } from '../../../domain/types';
import type { ToolPayload } from '../../../domain/types/tool';
import { attachToolsToAssistantMessage } from './historyToolPayload';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function toolFromCallId(toolsByCallId: Map<string, ToolPayload>, toolCallId: string): ToolPayload | undefined {
  return toolsByCallId.get(toolCallId);
}

export function mapPersistedTurnSegments(
  raw: unknown,
  toolsByCallId: Map<string, ToolPayload>,
): AssistantTurnSegment[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const segments: AssistantTurnSegment[] = [];

  for (const item of raw) {
    const record = asRecord(item);
    if (!record || typeof record.kind !== 'string') continue;

    if (record.kind === 'reasoning') {
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      if (!text) continue;
      const duration =
        typeof record.durationSec === 'string'
          ? record.durationSec
          : typeof record.durationSec === 'number'
            ? record.durationSec.toFixed(1)
            : '0.0';
      const id = typeof record.id === 'string' ? record.id : `reasoning-${segments.length + 1}`;
      segments.push({
        kind: 'reasoning',
        id,
        reasoning: {
          id,
          label: `已深度思考（${duration}s）`,
          duration,
          thinking: false,
          open: false,
          paragraphs: text.split(/\n\n+/).filter(Boolean),
        },
      });
      continue;
    }

    if (record.kind === 'text') {
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      if (!text) continue;
      const id = typeof record.id === 'string' ? record.id : `text-${segments.length + 1}`;
      segments.push({ kind: 'text', id, text });
      continue;
    }

    if (record.kind === 'tool') {
      const toolCallId = typeof record.toolCallId === 'string' ? record.toolCallId : '';
      const tool = toolCallId ? toolFromCallId(toolsByCallId, toolCallId) : undefined;
      if (!tool) continue;
      segments.push({
        kind: 'tool',
        id: typeof record.id === 'string' ? record.id : toolCallId,
        tool,
      });
      continue;
    }

    if (record.kind === 'tools' && Array.isArray(record.toolCallIds)) {
      const tools = record.toolCallIds.flatMap((toolCallId) => {
        if (typeof toolCallId !== 'string') return [];
        const tool = toolFromCallId(toolsByCallId, toolCallId);
        return tool ? [tool] : [];
      });
      if (tools.length === 0) continue;
      segments.push({
        kind: 'tools',
        id: typeof record.id === 'string' ? record.id : `tools-${segments.length + 1}`,
        tools,
      });
    }
  }

  return segments;
}

export function buildToolsByCallId(tools: ToolPayload[]): Map<string, ToolPayload> {
  const map = new Map<string, ToolPayload>();
  for (const tool of tools) {
    const key = tool.toolCallId ?? tool.id;
    if (key) map.set(key, tool);
  }
  return map;
}

export function attachTurnSegmentsFromMetadata(
  message: Message,
  metadata: Record<string, unknown> | undefined,
  tools: ToolPayload[],
): Message {
  const turnSegments = mapPersistedTurnSegments(metadata?.turnSegments, buildToolsByCallId(tools));
  if (turnSegments.length === 0) {
    return attachToolsToAssistantMessage(message, tools);
  }
  return {
    ...attachToolsToAssistantMessage(message, tools),
    turnSegments,
    tool: undefined,
    tools: undefined,
  };
}
