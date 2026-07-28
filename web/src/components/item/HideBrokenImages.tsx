'use client';

import { useEffect } from 'react';

export function HideBrokenImages({ rootSelector = '.item-prose' }: { rootSelector?: string }) {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;

    const hide = (img: HTMLImageElement) => {
      img.style.display = 'none';
    };

    const onError = (event: Event) => {
      hide(event.currentTarget as HTMLImageElement);
    };

    const imgs = Array.from(root.querySelectorAll('img'));
    for (const img of imgs) {
      img.addEventListener('error', onError);
      if (img.complete && img.naturalWidth === 0) hide(img);
    }

    return () => {
      for (const img of imgs) img.removeEventListener('error', onError);
    };
  }, [rootSelector]);

  return null;
}
