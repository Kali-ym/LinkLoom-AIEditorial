'use client';

import { Monitor, Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const MODES = [
  { value: 'dark', icon: Moon, label: '深色模式' },
  { value: 'system', icon: Monitor, label: '跟随系统' },
  { value: 'light', icon: Sun, label: '浅色模式' }
] as const;

type ThemeMode = (typeof MODES)[number]['value'];

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

const trackShell = 'relative flex rounded-full bg-surface-soft p-1 ring-1 ring-hairline';

const thumbShell =
  'pointer-events-none absolute top-1 bottom-1 rounded-full bg-canvas shadow-[0_1px_3px_rgba(15,23,42,0.10)] transition-[left,width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none dark:bg-surface-card dark:shadow-[0_1px_4px_rgba(0,0,0,0.45)]';

const btnBase =
  'relative z-10 inline-flex flex-1 items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas';

export function ThemeToggle({ className = '', compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });

  const current = (theme ?? 'system') as ThemeMode;
  const activeIndex = Math.max(
    0,
    MODES.findIndex((mode) => mode.value === current)
  );

  const sizeClass = compact ? 'h-9 w-[5.625rem]' : 'h-10 w-full min-w-[5.625rem]';

  const syncThumb = useCallback(() => {
    const track = trackRef.current;
    const active = itemRefs.current[activeIndex];
    if (!track || !active) return;

    const trackRect = track.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setThumb({
      left: activeRect.left - trackRect.left,
      width: activeRect.width
    });
  }, [activeIndex]);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!mounted) return;
    syncThumb();
  }, [mounted, syncThumb, current]);

  useEffect(() => {
    if (!mounted) return;
    const track = trackRef.current;
    if (!track) return;

    const ro = new ResizeObserver(() => syncThumb());
    ro.observe(track);
    window.addEventListener('resize', syncThumb);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncThumb);
    };
  }, [mounted, syncThumb]);

  if (!mounted) {
    return <div className={`${trackShell} ${sizeClass} ${className}`} aria-hidden />;
  }

  return (
    <div
      ref={trackRef}
      className={`${trackShell} ${sizeClass} ${className}`}
      role="group"
      aria-label="主题模式"
    >
      <div
        aria-hidden
        className={thumbShell}
        style={{ left: thumb.width > 0 ? thumb.left : undefined, width: thumb.width || undefined }}
      />
      {MODES.map(({ value, icon: Icon, label }, index) => {
        const active = value === current;
        return (
          <button
            key={value}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => setTheme(value)}
            className={`${btnBase} ${compact ? 'h-7 min-w-[1.75rem]' : 'h-8 min-w-[2rem]'} ${
              active ? 'text-ink' : 'text-muted hover:text-body active:scale-95'
            }`}
          >
            <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} weight="regular" />
          </button>
        );
      })}
    </div>
  );
}

export const headerIconButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-hairline-soft transition-colors hover:bg-surface-card active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]';
