import type { Message } from '../../domain/types';
import { getForkSeedMessages } from './clientTopicStorage';
import { mergeForkSeedWithApiMessages } from './mergeForkMessages';

/** Pre-merge remote API messages with fork seed before mergeRefreshedMessages. */
export function resolveRemoteMessagesForRefresh(topicId: string, remote: Message[]): Message[] {
  const seed = getForkSeedMessages(topicId);
  return seed.length > 0 ? mergeForkSeedWithApiMessages(seed, remote) : remote;
}
