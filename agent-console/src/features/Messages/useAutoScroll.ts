import { useCallback, useEffect, useRef } from 'react';

/** Auto-scroll conversation viewport when new content arrives near the bottom. */
export function useAutoScroll<T extends HTMLElement>({
  deps,
  enabled,
  threshold = 120,
}: {
  deps: unknown[];
  enabled: boolean;
  threshold?: number;
}) {
  const ref = useRef<T | null>(null);
  const pinnedRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distance <= threshold;
  }, [threshold]);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [enabled, ...deps]);

  return { ref, handleScroll };
}
