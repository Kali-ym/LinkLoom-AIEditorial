'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react';
import { CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react';
import type { FeedTagCount } from '@/lib/types';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  'aria-label': string;
  placeholder?: string;
  /** Available tags from GET /api/feed/tags. */
  options?: FeedTagCount[];
  /** Tags already used elsewhere (e.g. the other of include/exclude). */
  disabledOptions?: string[];
  className?: string;
  loading?: boolean;
}

const CHIP_GAP = 6; // gap-1.5

function ChipRemove({ tag, onRemove }: { tag: string; onRemove: (tag: string) => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`移除 ${tag}`}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-primary/70 transition-colors hover:text-primary"
      onClick={(e) => {
        e.stopPropagation();
        onRemove(tag);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onRemove(tag);
        }
      }}
    >
      <X size={10} weight="bold" aria-hidden />
    </span>
  );
}

export function TagChipInput({
  tags,
  onChange,
  'aria-label': ariaLabel,
  placeholder = '选择话题',
  options = [],
  disabledOptions = [],
  className = '',
  loading = false
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(tags.length);

  const selectedSet = useMemo(() => new Set(tags.map((t) => t.toLowerCase())), [tags]);
  const blockedSet = useMemo(
    () => new Set(disabledOptions.map((t) => t.toLowerCase())),
    [disabledOptions]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      if (blockedSet.has(opt.tag.toLowerCase())) return false;
      if (!q) return true;
      return opt.tag.toLowerCase().includes(q);
    });
  }, [options, blockedSet, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setQuery('');
  }, [open]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const measure = measureRef.current;
    if (!track || !measure || tags.length === 0) {
      setVisibleCount(tags.length);
      return;
    }

    const recompute = () => {
      const available = track.clientWidth;
      if (available <= 0) return;

      const chipEls = Array.from(measure.querySelectorAll<HTMLElement>('[data-measure-chip]'));
      const overflowEls = Array.from(
        measure.querySelectorAll<HTMLElement>('[data-measure-overflow]')
      );
      const chipWidths = chipEls.map((el) => el.offsetWidth);
      const overflowByHidden = new Map<number, number>();
      for (const el of overflowEls) {
        const hidden = Number(el.dataset.hidden || '0');
        overflowByHidden.set(hidden, el.offsetWidth);
      }

      let nextVisible = 0;
      for (let count = tags.length; count >= 0; count -= 1) {
        const hidden = tags.length - count;
        let width = 0;
        for (let i = 0; i < count; i += 1) {
          width += chipWidths[i] || 0;
          if (i > 0) width += CHIP_GAP;
        }
        if (hidden > 0) {
          if (count > 0) width += CHIP_GAP;
          width += overflowByHidden.get(hidden) || 32;
        }
        if (width <= available) {
          nextVisible = count;
          break;
        }
      }

      setVisibleCount((prev) => (prev === nextVisible ? prev : nextVisible));
    };

    recompute();
    const ro = new ResizeObserver(() => recompute());
    ro.observe(track);
    return () => ro.disconnect();
  }, [tags]);

  const toggle = (tag: string) => {
    const key = tag.toLowerCase();
    if (blockedSet.has(key)) return;
    if (selectedSet.has(key)) {
      onChange(tags.filter((t) => t.toLowerCase() !== key));
      return;
    }
    const canonical = options.find((o) => o.tag.toLowerCase() === key)?.tag || tag;
    onChange([...tags, canonical]);
  };

  const remove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = filtered.find((o) => !selectedSet.has(o.tag.toLowerCase()));
      if (first) toggle(first.tag);
    }
  };

  const visibleTags = tags.slice(0, visibleCount);
  const hiddenCount = Math.max(0, tags.length - visibleCount);
  const hiddenTitle = tags
    .slice(visibleCount)
    .map((t) => `#${t}`)
    .join('、');

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {/* Offscreen measure row: all chips + possible +N widths */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -z-10 h-0 overflow-hidden opacity-0"
      >
        <div ref={measureRef} className="flex w-max items-center gap-1.5 whitespace-nowrap">
          {tags.map((tag) => (
            <span
              key={tag}
              data-measure-chip
              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/8 px-2 py-0.5 text-[12px] font-medium text-primary"
            >
              <span>#{tag}</span>
              <span className="inline-flex h-4 w-4" />
            </span>
          ))}
          {tags.map((_, index) => {
            const hidden = tags.length - index;
            if (hidden <= 0) return null;
            return (
              <span
                key={`overflow-${hidden}`}
                data-measure-overflow
                data-hidden={hidden}
                className="inline-flex items-center rounded-md border border-hairline bg-surface-soft px-2 py-0.5 text-[12px] font-medium tabular-nums text-muted"
              >
                +{hidden}
              </span>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 w-full items-center gap-2 rounded-lg border bg-canvas px-3 text-left transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-wait ${
          open ? 'border-primary' : 'border-hairline hover:border-hairline-strong'
        }`}
      >
        <div ref={trackRef} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {tags.length === 0 ? (
            <span className="truncate text-sm text-steel">
              {loading ? '加载话题…' : placeholder}
            </span>
          ) : (
            <>
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/20 bg-primary/8 px-2 py-0.5 text-[12px] font-medium text-primary"
                >
                  <span>#{tag}</span>
                  <ChipRemove tag={tag} onRemove={remove} />
                </span>
              ))}
              {hiddenCount > 0 ? (
                <span
                  className="inline-flex shrink-0 items-center rounded-md border border-hairline bg-surface-soft px-2 py-0.5 text-[12px] font-medium tabular-nums text-muted"
                  title={hiddenTitle}
                >
                  +{hiddenCount}
                </span>
              ) : null}
            </>
          )}
        </div>
        <CaretDown
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          weight="bold"
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute z-40 mt-2 w-full min-w-[16rem] overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_12px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
            <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted" weight="regular" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="筛选话题"
              aria-label={`${ariaLabel}搜索`}
              className="h-7 w-full bg-transparent text-sm text-ink outline-none placeholder:text-steel"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-2.5">
            {filtered.length === 0 ? (
              <p className="px-1.5 py-3 text-sm text-muted">
                {options.length === 0 ? '暂无可用话题' : '无匹配话题'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filtered.slice(0, 100).map((opt) => {
                  const active = selectedSet.has(opt.tag.toLowerCase());
                  return (
                    <button
                      key={opt.tag}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(opt.tag)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                        active
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-hairline bg-canvas text-body hover:border-primary/40 hover:text-ink'
                      }`}
                    >
                      <span>#{opt.tag}</span>
                      <span
                        className={`font-mono text-[10px] tabular-nums ${
                          active ? 'text-on-primary/75' : 'text-muted'
                        }`}
                      >
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex items-center justify-between border-t border-hairline px-3 py-2">
              <span className="text-[12px] text-muted">已选 {tags.length}</span>
              <button
                type="button"
                className="text-[12px] font-medium text-muted transition-colors hover:text-ink"
                onClick={() => onChange([])}
              >
                清空
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
