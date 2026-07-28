import { useEffect } from 'react';

import { useTopicsViewDataStore } from '../stores/topicsViewDataStore';

interface UseFetchAgentTopicsViewOptions {
  agentId: string | null | undefined;
  enabled?: boolean;
}

/** §C.53*/
export function useFetchAgentTopicsView({
  agentId,
  enabled = true,
}: UseFetchAgentTopicsViewOptions) {
  const items = useTopicsViewDataStore((s) => s.items);
  const hasMore = useTopicsViewDataStore((s) => s.hasMore);
  const isLoading = useTopicsViewDataStore((s) => s.isLoading);
  const isLoadingMore = useTopicsViewDataStore((s) => s.isLoadingMore);
  const hydrateForAgent = useTopicsViewDataStore((s) => s.hydrateForAgent);
  const loadMore = useTopicsViewDataStore((s) => s.loadMore);
  const refresh = useTopicsViewDataStore((s) => s.refresh);

  useEffect(() => {
    if (!enabled || !agentId) return;
    void hydrateForAgent(agentId);
  }, [agentId, enabled, hydrateForAgent]);

  return {
    items,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    refresh,
    mutate: refresh,
  };
}
