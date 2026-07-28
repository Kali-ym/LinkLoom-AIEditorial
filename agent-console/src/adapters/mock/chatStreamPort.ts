import type { IChatStreamPort } from '../ports/IChatStreamPort';
import { runStreamingHandler } from '../../services/mock/StreamingHandler';

const mockStreamRuns = new Map<string, { userText: string; agentId?: string }>();

export function registerMockStreamRun(runId: string, userText: string, agentId?: string): void {
  mockStreamRuns.set(runId, { userText, agentId });
}

export const mockChatStreamPort: IChatStreamPort = {
  subscribe(runId, handlers) {
    let cancelled = false;
    const controller = new AbortController();
    const run = mockStreamRuns.get(runId);
    const userText = run?.userText ?? '';
    const agentId = run?.agentId;
    mockStreamRuns.delete(runId);

    void (async () => {
      try {
        let sawStop = false;
        await runStreamingHandler(
          userText,
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (cancelled) return;
              handlers.onEvent?.(event);
              if (event.type === 'stop') sawStop = true;
            },
          },
          { agentId },
        );

        if (cancelled || controller.signal.aborted) return;

        if (!sawStop) {
          handlers.onEvent?.({ type: 'stop' });
        }

        handlers.onDone();
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        handlers.onError(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  },
};
