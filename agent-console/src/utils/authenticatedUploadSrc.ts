import { useEffect, useState } from 'react';

import { agentConsoleFetch } from '../adapters/api/http';

function toFetchPath(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace(/^https?:\/\/[^/]+/, '');
  }
  return url.startsWith('/') ? url : `/${url}`;
}

function isAgentUploadUrl(url: string): boolean {
  return /\/api\/agent-uploads\//.test(url);
}

/** Load agent-upload URLs with auth headers — plain <img src> cannot send Bearer token. */
export function useAuthenticatedUploadSrc(url: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(
    () => (url?.startsWith('blob:') ? url : undefined),
  );

  useEffect(() => {
    if (!url) {
      setResolved(undefined);
      return;
    }

    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setResolved(url);
      return;
    }

    if (!isAgentUploadUrl(url)) {
      setResolved(url);
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;

    void (async () => {
      try {
        const path = toFetchPath(url);
        const response = await agentConsoleFetch(path);
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      } catch {
        if (!cancelled) setResolved(undefined);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return resolved;
}
