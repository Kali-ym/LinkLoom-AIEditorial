'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Props {
  basePath?: string;
  placeholder?: string;
  /** Extra classes on the search form; omit max-width when full-bleed under filters. */
  className?: string;
}

export function FeedSearch({
  basePath,
  placeholder = '搜索标题 / 摘要…',
  className
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params?.get('q') ?? '');

  useEffect(() => {
    setValue(params?.get('q') ?? '');
  }, [params]);

  const submit = (next: string) => {
    const target = basePath ?? pathname ?? '/';
    const sp = new URLSearchParams(params?.toString() || '');
    const trimmed = next.trim();
    if (trimmed) sp.set('q', trimmed);
    else sp.delete('q');
    const qs = sp.toString();
    router.push(qs ? `${target}?${qs}` : target);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className={
        className
          ? `search-pill border-hairline bg-canvas ${className}`
          : 'search-pill w-full min-w-0 border-hairline bg-canvas lg:max-w-[22rem]'
      }
      role="search"
    >
      <MagnifyingGlass
        className="pointer-events-none h-4 w-4 shrink-0 text-stone"
        weight="regular"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="搜索"
        className="search-pill__input"
      />
      <button type="submit" className="btn-primary shrink-0">
        搜索
      </button>
    </form>
  );
}
