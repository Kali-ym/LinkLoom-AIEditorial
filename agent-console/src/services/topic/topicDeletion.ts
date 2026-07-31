import type { Topic } from '../../domain/types';
import { isEphemeralTopicId } from '../../adapters/api/mappers/sessionTopic';

/**
 * Resolve client-only topic ids before local removal clears sessionStorage.
 * `tpc_*` drafts are ephemeral while still in client storage; after removal
 * `isEphemeralTopicId` would falsely treat them as server-backed.
 */
export function collectClientOnlyTopicIds(
  topicIds: string[],
  topics: Topic[],
): Set<string> {
  const idSet = new Set(topicIds.filter(Boolean));
  const clientOnly = new Set<string>();

  for (const id of idSet) {
    if (isEphemeralTopicId(id)) {
      clientOnly.add(id);
    }
  }

  for (const topic of topics) {
    if (!idSet.has(topic.id)) continue;
    if (topic.status === 'temp' || isEphemeralTopicId(topic.id)) {
      clientOnly.add(topic.id);
    }
  }

  return clientOnly;
}
