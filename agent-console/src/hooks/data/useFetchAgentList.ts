import { useIsFetching } from '@tanstack/react-query';

import { useAgentListStore } from '../../stores';
import { isAgentConsoleApiMode } from './ports';
import { agentConsoleQueryKeys } from './queryKeys';

/** Agent list loading gate for sidebar / switcher skeletons. */
export function useFetchAgentList(): { isLoading: boolean } {
  const isApi = isAgentConsoleApiMode();
  const isInit = useAgentListStore((s) => s.isAgentListInit);
  const fetchingCount = useIsFetching({ queryKey: agentConsoleQueryKeys.agentListBundle() });

  if (!isApi) {
    return { isLoading: !isInit };
  }

  return { isLoading: fetchingCount > 0 };
}
