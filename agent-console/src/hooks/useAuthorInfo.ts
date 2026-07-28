import { useMemo } from 'react';

import type { AuthorInfo } from '../domain/types';
import { useConfigStore } from '../stores/configStore';

/** Mock author lookup*/
export function useAuthorInfo(userId?: string): AuthorInfo | undefined {
  const authorsByUserId = useConfigStore((s) => s.authorsByUserId);
  return useMemo(() => {
    if (!userId) return undefined;
    return authorsByUserId[userId];
  }, [authorsByUserId, userId]);
}
