import type { ChatStreamHandlers, ChatStreamSubscribeOptions, IChatStreamPort } from '../ports/IChatStreamPort';
import { agentConsoleOpenEventStream } from './http';
import { mapAgentEventToChatStreamEvents } from './mappers/agentEventStream';
import {
  normalizeAgentEventItem,
  parseSseFrames,
  type AgentEventItem,
} from '../../utils/agentEvents';
import { useStreamingStore } from '../../stores/streamingStore';

function deliverEventBatch(
  runId: string,
  events: AgentEventItem[],
  handlers: ChatStreamHandlers,
  seenSequences: Set<number>,
): void {
  let sawRunPausedInBatch = false;
  for (const event of events) {
    if (typeof event.sequence === 'number') {
      if (seenSequences.has(event.sequence)) continue;
      seenSequences.add(event.sequence);
    }
    const streamEvents = mapAgentEventToChatStreamEvents(event);
    useStreamingStore.getState().recordRunEventSeq(runId, event.sequence);
    for (const streamEvent of streamEvents) {
      handlers.onEvent?.(streamEvent);
      if (!handlers.onEvent && streamEvent.type === 'content_part') {
        const chunk = streamEvent.text ?? streamEvent.content ?? '';
        if (chunk) handlers.onChunk?.(chunk);
      }
      if (streamEvent.type === 'run_paused') sawRunPausedInBatch = true;
    }
  }
  handlers.onAfterBatch?.();
  if (sawRunPausedInBatch) handlers.onRunPausedBatch?.();
}

export const apiChatStreamPort: IChatStreamPort = {
  subscribe(runId, handlers, options?: ChatStreamSubscribeOptions) {
    const controller = new AbortController();
    const lastSeq = options?.lastSeq ?? 0;
    const query = new URLSearchParams({ stream: 'true' });
    if (lastSeq > 0) {
      query.set('lastSeq', String(lastSeq));
    }

    void (async () => {
      const seenSequences = new Set<number>();
      try {
        const reader = await agentConsoleOpenEventStream(
          `/api/agent-runs/${encodeURIComponent(runId)}/events?${query.toString()}`,
          controller.signal,
        );

        const decoder = new TextDecoder();
        let buffer = '';

        const parseBufferedEvents = (input: string) =>
          parseSseFrames(input, (payload) => {
            const data = JSON.parse(payload) as AgentEventItem & { error?: string };
            if (data.type === 'error') {
              throw new Error(data.error || 'SSE stream error');
            }
            return normalizeAgentEventItem(data);
          });

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
          }

          const parsed = parseBufferedEvents(buffer);
          buffer = parsed.rest;

          deliverEventBatch(runId, parsed.events, handlers, seenSequences);

          if (parsed.done) {
            handlers.onDone();
            return;
          }

          if (done) {
            if (buffer.trim()) {
              const tail = parseBufferedEvents(`${buffer}\n\n`);
              deliverEventBatch(runId, tail.events, handlers, seenSequences);
            }
            break;
          }
        }

        handlers.onDone();
      } catch (error) {
        if (controller.signal.aborted) return;
        handlers.onError(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return () => controller.abort();
  },
};
