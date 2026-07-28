import { useEffect, useMemo, useRef, useState } from 'react';

import { ensureMarkdownLinks, sanitizeMermaidFences } from './messageMarkdown';

/**
 * Return the streaming content for the Markdown renderer.
 *
 * While streaming, the raw `content` is returned directly so that
 * `@lobehub/ui`'s `StreamdownRender` can apply its own adaptive stream
 * smoothing (`useSmoothStreamContent` + block-level memoization). Wrapping the
 * content in an external RAF/throttle here would defeat that: lobehub would
 * receive already-coalesced "jumps" instead of the per-token deltas its CPS
 * smoother is designed for, and the full-text Markdown re-parse on every
 * external flush is the O(n²) cause of "streaming gets slower the longer it
 * goes".
 *
 * Non-streaming content is committed synchronously so finalized text appears
 * immediately. The internal `committed` state exists only to keep the returned
 * value stable across renders when `content` itself is referentially stable.
 */
export function useStreamingContentBuffer(content: string | undefined, streaming: boolean | undefined): string {
  const [committed, setCommitted] = useState(content ?? '');
  const lastContentRef = useRef(content ?? '');
  const wasStreamingRef = useRef(Boolean(streaming));

  useEffect(() => {
    const next = content ?? '';
    const streamingJustTurnedOff = wasStreamingRef.current && !streaming;
    wasStreamingRef.current = Boolean(streaming);

    if (lastContentRef.current === next && !streamingJustTurnedOff) return;
    lastContentRef.current = next;
    if (!streaming) {
      setCommitted(next);
    }
  }, [content, streaming]);

  useEffect(() => {
    return () => {
      lastContentRef.current = '';
    };
  }, []);

  const visibleContent = streaming ? (content ?? '') : committed;

  // ensureMarkdownLinks runs two full-text regex passes; memoize so it only
  // recomputes when the visible content actually changes.
  return useMemo(() => {
    if (!visibleContent) return '';
    return sanitizeMermaidFences(ensureMarkdownLinks(visibleContent));
  }, [visibleContent]);
}
