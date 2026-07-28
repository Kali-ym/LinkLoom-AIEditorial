import { useReviewPatches as useReviewPatchesQuery } from '../../../hooks/data/useRuntime';
import type { ReviewMode } from '../../../domain/types/review';
import type { ReviewFile } from '../../../domain/types';

interface ReviewPatchesState {
  patches: ReviewFile[];
  baseRef?: string;
  headRef?: string;
  isLoading: boolean;
  isValidating: boolean;
  refresh: () => Promise<void>;
}

/** §C.16*/
export function useReviewPatches(
  workingDirectory: string,
  mode: ReviewMode,
  baseOverride?: string,
): ReviewPatchesState {
  const { data, isLoading, isFetching, refetch } = useReviewPatchesQuery(
    workingDirectory,
    mode,
    baseOverride,
  );

  return {
    patches: data?.patches ?? [],
    baseRef: data?.baseRef,
    headRef: data?.headRef,
    isLoading,
    isValidating: isFetching && !isLoading,
    refresh: async () => {
      await refetch();
    },
  };
}
