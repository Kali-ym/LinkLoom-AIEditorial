import { useEffect, useState } from 'react';

/** Simple debounce*/
export function useDebouncedValue<T>(value: T, wait: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), wait);
    return () => window.clearTimeout(id);
  }, [value, wait]);

  return debounced;
}
