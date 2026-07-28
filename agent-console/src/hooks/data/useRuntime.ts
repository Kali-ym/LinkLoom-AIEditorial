import { checkSecurityBlacklist } from '../../adapters/interventionSecurity';
import { getVerifyState } from '../../adapters/verifyStateMocks';
import type { ReviewMode } from '../../domain/types/review';
import { useWorkspaceStore, useTopicStore } from '../../stores';
import { useQuery } from '@tanstack/react-query';
import { agentConsoleQueryKeys } from './queryKeys';

export { checkSecurityBlacklist, getVerifyState };

export function useReviewPatches(
  workingDirectory: string,
  mode: ReviewMode,
  baseOverride?: string,
) {
  return useQuery({
    enabled: Boolean(workingDirectory),
    queryKey: agentConsoleQueryKeys.reviewPatches(workingDirectory, mode, baseOverride),
    queryFn: async () => {
      const topicId = useTopicStore.getState().activeTopicId;
      const files = useWorkspaceStore.getState().getReviewFiles(topicId);
      return {
        baseRef: baseOverride ?? 'main',
        headRef: 'HEAD',
        patches: files,
      };
    },
    staleTime: 10_000,
  });
}
