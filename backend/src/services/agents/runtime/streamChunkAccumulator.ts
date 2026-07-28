import type { AgentExecutionResult } from '../../../types/agent.js';

export interface RuntimeStreamAccumulation {
  content: string;
  stopReason: AgentExecutionResult['stopReason'];
}

export function createRuntimeStreamAccumulation(
  stopReason: AgentExecutionResult['stopReason'] = 'max_rounds',
): RuntimeStreamAccumulation {
  return { content: '', stopReason };
}

export function accumulateRuntimeStreamChunk(
  chunk: unknown,
  state: RuntimeStreamAccumulation,
): void {
  if (!chunk || typeof chunk !== 'object') return;
  const payload = chunk as Record<string, unknown>;
  if (payload.type === 'content' && typeof payload.content === 'string') {
    state.content += payload.content;
    return;
  }
  if (payload.type === 'final_content' && typeof payload.content === 'string') {
    state.content = payload.content;
    return;
  }
  if (payload.type === 'final_trace' && typeof payload.stopReason === 'string') {
    state.stopReason = payload.stopReason as AgentExecutionResult['stopReason'];
  }
}
