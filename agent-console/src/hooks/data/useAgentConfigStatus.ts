import { useAgentStore } from '../../stores';

/** Active agent config loading / error surface for ChatInput. */
export function useAgentConfigStatus() {
  const configError = useAgentStore((s) => s.configError);
  const isConfigLoading = useAgentStore((s) => s.isConfigLoading);
  const retryAgentConfigFetch = useAgentStore((s) => s.retryAgentConfigFetch);

  return { configError, isConfigLoading, retryAgentConfigFetch };
}
