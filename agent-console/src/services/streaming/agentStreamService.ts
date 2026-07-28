import { getAgentConsolePorts, isAgentConsoleApiMode } from '../../adapters/registry';
import { startAgentRun } from '../../adapters/api/agentRun';
import { registerMockStreamRun } from '../../adapters/mock/chatStreamPort';
import type { RunContextMessage } from '../../adapters/api/mappers/runContext';
import type { FileRef } from '../../domain/types/userTurn';
import type { StreamEvent } from '../mock/StreamingHandler';
import { useAgentStore } from '../../stores/agentStore';
import { useChatStore } from '../../stores/chatStore';
import { useStreamingStore } from '../../stores/streamingStore';
import { buildAgentRunConsoleMetadata } from './reasoningEnabled';
import { assistantMessageIdForRun } from './assistantMessageId';
import { getEffectiveTopicModel } from '../../hooks/useTopicModel';

type ActiveRunStream = {
  generation: number;
  unsubscribe: () => void;
};

let runStreamGeneration = 0;
const activeRunStreams = new Map<string, ActiveRunStream>();

/** True while an SSE subscription for this run is still open (including permission pauses). */
export function isRunStreamActive(runId: string): boolean {
  return activeRunStreams.has(runId);
}

function listenToRunStream(
  runId: string,
  onEvent: (event: StreamEvent) => void,
  options?: {
    signal?: AbortSignal;
    lastSeq?: number;
    finishOnPause?: boolean;
  },
): Promise<void> {
  activeRunStreams.get(runId)?.unsubscribe();

  const generation = ++runStreamGeneration;

  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let unsubscribe = () => {};

    const finish = (_reason: string) => {
      if (finished) return;
      finished = true;
      const active = activeRunStreams.get(runId);
      if (active?.generation === generation) {
        activeRunStreams.delete(runId);
      }
      unsubscribe();
      onEvent({ type: 'stop' });
      resolve();
    };

    unsubscribe = getAgentConsolePorts().chatStream.subscribe(
      runId,
      {
        onEvent: (event) => {
          onEvent(event as StreamEvent);
          if (event.type === 'stop') finish('stop-event');
        },
        onRunPausedBatch: () => {
          if (options?.finishOnPause !== false) finish('run-paused-batch');
        },
        onDone: () => finish('sse-done'),
        onError: (error) => {
          if (finished) return;
          finished = true;
          const active = activeRunStreams.get(runId);
          if (active?.generation === generation) {
            activeRunStreams.delete(runId);
          }
          unsubscribe();
          reject(error);
        },
      },
      { lastSeq: options?.lastSeq },
    );

    activeRunStreams.set(runId, { generation, unsubscribe });

    options?.signal?.addEventListener('abort', () => {
      finish('aborted');
    });
  });
}

async function runApiAgentConversationStream(
  agentId: string,
  userText: string,
  onEvent: (event: StreamEvent) => void,
  options?: {
    signal?: AbortSignal;
    topicId?: string;
    threadId?: string;
    messages?: RunContextMessage[];
    message?: string;
    editorData?: Record<string, unknown>;
    files?: FileRef[];
  },
): Promise<void> {
  const topicId = options?.topicId;
  if (!topicId) {
    throw new Error('topicId is required when VITE_AGENT_CONSOLE_DATA=api');
  }

  const agentState = useAgentStore.getState();
  const plusState = agentState.getActivePlusState();
  const metadata = buildAgentRunConsoleMetadata(
    agentId,
    plusState,
    agentState.plusStateByAgentId,
    getEffectiveTopicModel(topicId),
  );

  const { runId } = await startAgentRun({
    agentId,
    topicId,
    message: options?.message ?? userText,
    editorData: options?.editorData,
    files: options?.files,
    threadId: options?.threadId,
    messages: options?.messages,
    stream: plusState.chatConfig.enableStreaming !== false,
    metadata,
  });

  useStreamingStore.getState().setActiveRunContext(topicId, { runId });
  useChatStore.getState().remapStreamingAssistantId(topicId, assistantMessageIdForRun(runId));

  await listenToRunStream(runId, onEvent, { signal: options?.signal, finishOnPause: false });
}

/** Subscribe to an already-started backend run (regenerate or post-approval resume). */
export async function subscribeAgentRunStream(
  runId: string,
  _userText: string,
  onEvent: (event: StreamEvent) => void,
  options?: {
    signal?: AbortSignal;
    topicId?: string;
    lastSeq?: number;
    finishOnPause?: boolean;
  },
): Promise<void> {
  const topicId = options?.topicId;
  if (topicId) {
    useStreamingStore.getState().setActiveRunContext(topicId, { runId });
    useChatStore.getState().remapStreamingAssistantId(topicId, assistantMessageIdForRun(runId));
  }

  await listenToRunStream(runId, onEvent, {
    signal: options?.signal,
    lastSeq: options?.lastSeq,
    finishOnPause: options?.finishOnPause,
  });
}

/** Unified entry: mock or api chatStream Port. */
export async function runAgentConversationStream(
  agentId: string,
  userText: string,
  onEvent: (event: StreamEvent) => void,
  options?: {
    signal?: AbortSignal;
    date?: string;
    topicId?: string;
    threadId?: string;
    messages?: RunContextMessage[];
    message?: string;
    editorData?: Record<string, unknown>;
    files?: FileRef[];
  },
): Promise<void> {
  if (isAgentConsoleApiMode()) {
    await runApiAgentConversationStream(agentId, userText, onEvent, options);
    return;
  }

  const runId = `mock-run-${Date.now()}`;
  registerMockStreamRun(runId, userText, agentId);
  if (options?.topicId) {
    useStreamingStore.getState().setActiveRunContext(options.topicId, { runId });
  }
  await listenToRunStream(runId, onEvent, { signal: options?.signal, finishOnPause: false });
}
