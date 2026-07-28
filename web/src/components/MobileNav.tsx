'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fire, ListBullets, Newspaper, Info, List, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle, headerIconButtonClass } from '@/components/ThemeToggle';
import { useRememberedFeedHref } from '@/hooks/useRememberedFeedHref';

const NAV = [
  { href: '/', label: '热搜', icon: Fire },
  { href: '/feed', label: '信息流', icon: ListBullets },
  { href: '/daily', label: '日报', icon: Newspaper },
  { href: '/about', label: '关于', icon: Info }
];

export function MobileNav() {
  const pathname = usePathname() || '/';
  const feedHref = useRememberedFeedHref();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/daily') {
      return pathname === '/daily' || pathname.startsWith('/daily/');
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size="sm" className="shadow-sm dark:shadow-[0_4px_14px_rgba(0,0,0,0.35)]" />
            <span>
              <span className="block font-display text-xl leading-none text-ink tracking-[-0.03em]">
                LinkLoom
              </span>
              <span className="block text-[10px] text-muted-soft">
                AI Editorial
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle compact />
            <button
              type="button"
              aria-label={open ? '关闭菜单' : '打开菜单'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={headerIconButtonClass}
            >
              {open ? (
                <X className="h-4 w-4" weight="regular" />
              ) : (
                <List className="h-4 w-4" weight="regular" />
              )}
            </button>
          </div>
        </div>
        {open && (
          <nav className="flex flex-col gap-0.5 px-4 pb-4">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              const to = href === '/feed' ? feedHref : href;
              return (
                <Link
                  key={href}
                  href={to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 border-l-2 py-2.5 pl-3 pr-3 text-sm font-medium transition-colors ${
                    active
                      ? 'border-primary bg-transparent text-ink'
                      : 'border-transparent text-muted hover:bg-surface-soft/60 hover:text-ink'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : ''}`}
                    weight="regular"
                  />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
    </>
  );
}
