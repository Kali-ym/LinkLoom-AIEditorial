import { hasTopicPendingIntervention, syncStaleApprovalContext } from './interventionGate';
import type { StreamEvent } from './streamEvent';

/** SSE events that must still be applied after user abort (late permission pause). */
export function isPermissionPauseStreamEvent(event: StreamEvent): boolean {
  if (event.type === 'hitl_context' || event.type === 'run_paused') return true;
  if (event.type === 'tool_calls') {
    return event.tools?.some((tool) => tool.intervention?.status === 'pending') ?? false;
  }
  return false;
}

export function shouldHydrateMessagesAfterPermissionPause(topicId: string): boolean {
  syncStaleApprovalContext(topicId);
  return hasTopicPendingIntervention(topicId);
}
