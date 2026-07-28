import { readStoredActiveAgentId } from '../../services/agent/activeAgentStorage';
import { useAgentStore } from '../../stores';

/** Fallback when portal payload omits agentId — prefer store, then localStorage. */
export function readActiveAgentIdFallback(): string | null {
  const fromStore = useAgentStore.getState().activeAgentId;
  if (fromStore) return fromStore;
  return readStoredActiveAgentId();
}
