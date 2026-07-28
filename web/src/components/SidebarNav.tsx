'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fire, ListBullets, Newspaper, Info } from '@phosphor-icons/react';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useRememberedFeedHref } from '@/hooks/useRememberedFeedHref';

const NAV = [
  { href: '/', label: '热搜', eyebrow: '今日轰动事件', icon: Fire },
  { href: '/feed', label: '信息流', eyebrow: '可筛选时间线', icon: ListBullets },
  { href: '/daily', label: '日报', eyebrow: '每日编辑版', icon: Newspaper },
  { href: '/about', label: '关于', eyebrow: '系统说明', icon: Info }
];

export function SidebarNav() {
  const pathname = usePathname() || '/';
  const feedHref = useRememberedFeedHref();
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/daily') {
      return pathname === '/daily' || pathname.startsWith('/daily/');
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex w-[256px] shrink-0 flex-col border-r border-hairline bg-canvas/90 h-full overflow-hidden backdrop-blur">
      <div className="px-6 pt-7 pb-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <BrandMark className="shadow-[0_10px_28px_rgba(15,23,42,0.18)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)]" />
          <span>
            <span className="block font-display text-2xl leading-none text-ink tracking-[-0.03em]">LinkLoom</span>
            <span className="mt-1 block text-[11px] text-muted-soft">AI Editorial</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map(({ href, label, eyebrow, icon: Icon }) => {
          const active = isActive(href);
          const to = href === '/feed' ? feedHref : href;
          return (
            <Link
              key={href}
              href={to}
              className={`group flex items-center gap-3 border-l-2 py-3 pl-3 pr-3 transition-colors ${
                active
                  ? 'border-primary bg-transparent text-ink'
                  : 'border-transparent text-muted hover:bg-surface-soft/60 hover:text-ink'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-muted group-hover:text-ink'}`}
                weight="regular"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-soft">{eyebrow}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-5 pt-2">
        <ThemeToggle />
      </div>
    </aside>
  );
}
