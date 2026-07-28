'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const ICONS = {
  light: '/icon.svg',
  dark: '/icon-dark.svg'
} as const;

function upsertIconLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-theme-icon]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    link.setAttribute('data-theme-icon', 'true');
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = href;
}

export function FaviconSync() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const href = resolvedTheme === 'dark' ? ICONS.dark : ICONS.light;
    upsertIconLink('icon', href);
    upsertIconLink('shortcut icon', href);
  }, [mounted, resolvedTheme]);

  return null;
}
