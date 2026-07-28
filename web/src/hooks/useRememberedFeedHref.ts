'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  FEED_QUERY_CHANGED_EVENT,
  rememberedFeedHref
} from '@/lib/feedQueryMemory';

/** Client href for「信息流」that restores the last filter query. */
export function useRememberedFeedHref(): string {
  const pathname = usePathname();
  const [href, setHref] = useState('/feed');

  useEffect(() => {
    const sync = () => setHref(rememberedFeedHref());
    sync();
    window.addEventListener(FEED_QUERY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(FEED_QUERY_CHANGED_EVENT, sync);
  }, [pathname]);

  return href;
}
