import type { GenericItemType } from '@lobehub/ui';

/** Upstream `useAgentTransferMenuItem` — workspace transfer 未启用时返回 null。 */
export function useAgentTransferMenuItem(_agentId: string): GenericItemType[] | null {
  return null;
}
