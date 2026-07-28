import { useAgentStore } from '../../stores/agentStore';
import { useFollowUpActionStore } from '../../stores/followUpActionStore';

/** Fetch follow-up chips after assistant turn when per-agent gate is on. */
export async function triggerFollowUpChips(topicId: string, messageId: string): Promise<void> {
  const plusState = useAgentStore.getState().getActivePlusState();
  if (!plusState.chatConfig.enableFollowUpChips) return;
  if (!plusState.model || !plusState.provider) return;

  await useFollowUpActionStore.getState().fetchFor(topicId, {
    messageId,
    topicId,
  });
}
