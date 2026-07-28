'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  url?: string;
  /** Preferred profile / author image; falls back to site favicon from `url`. */
  imageUrl?: string;
  label?: string;
  size?: number;
  className?: string;
  /** Soft rim around the glyph. Default off — call sites opt in. */
  framed?: boolean;
}

function domainFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function SourceFavicon({
  url,
  imageUrl,
  label,
  size = 28,
  className = '',
  framed = false
}: Props) {
  const domain = useMemo(() => domainFromUrl(url), [url]);
  const candidates = useMemo(() => {
    const list: string[] = [];
    const preferred = imageUrl?.trim();
    if (preferred) list.push(preferred);
    if (domain) list.push(`https://icons.folo.is/${encodeURIComponent(domain)}`);
    return list;
  }, [imageUrl, domain]);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setAttempt(0);
  }, [imageUrl, domain]);

  const src = candidates[attempt] ?? null;
  const fallbackChar = (label || domain || '?').trim().charAt(0).toUpperCase() || '?';
  const frame = framed ? 'border border-hairline' : 'border-0';

  if (!src) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md bg-surface-soft font-medium text-ink ${frame} ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }}
        aria-hidden
      >
        {fallbackChar}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full bg-transparent object-cover ${frame} ${className}`}
      onError={() => setAttempt((n) => n + 1)}
    />
  );
}
