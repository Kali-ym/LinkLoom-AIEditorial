import type { Message } from '../../domain/types';

/** fork 继承上下文 + 后端已持久化的本会话轮次。 */
export function mergeForkSeedWithApiMessages(seed: Message[], api: Message[]): Message[] {
  if (seed.length === 0) return api;
  if (api.length === 0) return seed;
  return [...seed, ...api];
}
