'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FEED_CATEGORIES } from '@/lib/categories';
import { FeedSearch } from '@/components/FeedSearch';
import { TagChipInput } from '@/components/feed/TagChipInput';
import { rememberFeedQuery } from '@/lib/feedQueryMemory';
import type { FeedTagCount } from '@/lib/types';

interface Props {
  basePath?: string;
}

function parseTags(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function FeedFilters({ basePath }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const target = basePath ?? pathname ?? '/feed';
  const picked = params?.get('picked') === '1';
  const category = params?.get('category') ?? '';
  const includeRaw = params?.get('includeTags') ?? '';
  const excludeRaw = params?.get('excludeTags') ?? '';
  const includeTags = useMemo(() => parseTags(includeRaw), [includeRaw]);
  const excludeTags = useMemo(() => parseTags(excludeRaw), [excludeRaw]);

  const [tagOptions, setTagOptions] = useState<FeedTagCount[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  useEffect(() => {
    rememberFeedQuery(params?.toString() || '');
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    setTagsLoading(true);
    fetch('/api/feed/tags?limit=200')
      .then(async (res) => {
        if (!res.ok) return { tags: [] as FeedTagCount[] };
        return (await res.json()) as { tags: FeedTagCount[] };
      })
      .then((data) => {
        if (cancelled) return;
        setTagOptions((data.tags || []).filter((t) => t?.tag));
      })
      .catch(() => {
        if (!cancelled) setTagOptions([]);
      })
      .finally(() => {
        if (!cancelled) setTagsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pushParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params?.toString() || '');
      mutate(next);
      if (next.has('category')) next.delete('topic');
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `${target}?${qs}` : target, { scroll: false });
      });
    },
    [params, router, target]
  );

  const setPicked = (on: boolean) => {
    pushParams((next) => {
      if (on) next.set('picked', '1');
      else next.delete('picked');
    });
  };

  const setCategory = (value: string) => {
    pushParams((next) => {
      if (value) next.set('category', value);
      else next.delete('category');
      next.delete('topic');
    });
  };

  const setTags = (key: 'includeTags' | 'excludeTags', tags: string[]) => {
    pushParams((next) => {
      if (tags.length) next.set(key, tags.join(','));
      else next.delete(key);
    });
  };

  return (
    <div
      className="w-full rounded-xl border border-hairline bg-surface-soft/40 p-3.5 sm:p-4"
      role="group"
      aria-label="信息流筛选"
    >
      <div className="flex flex-col gap-4">
        {/* Field grid: 分类 / 包含 / 排除 */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-3.5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="feed-category" className="text-[12px] font-medium text-muted">
              分类
            </label>
            <div className="relative">
              <select
                id="feed-category"
                aria-label="分类"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-hairline bg-canvas py-2 pr-9 pl-3 text-sm text-ink outline-none transition-colors focus:border-primary"
              >
                <option value="">全部分类</option>
                {FEED_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <CaretDown
                className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                weight="bold"
                aria-hidden
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-medium text-muted">包含</span>
              <span className="text-[11px] text-muted-soft" title="包含标签为任一匹配（OR）">
                匹配任一
              </span>
            </div>
            <TagChipInput
              tags={includeTags}
              onChange={(tags) => setTags('includeTags', tags)}
              aria-label="包含标签"
              placeholder="选择要包含的话题"
              options={tagOptions}
              disabledOptions={excludeTags}
              loading={tagsLoading}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted">排除</span>
            <TagChipInput
              tags={excludeTags}
              onChange={(tags) => setTags('excludeTags', tags)}
              aria-label="排除标签"
              placeholder="选择要排除的话题"
              options={tagOptions}
              disabledOptions={includeTags}
              loading={tagsLoading}
            />
          </div>
        </div>

        {/* Search + 仅精选 */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-hairline pt-3.5">
          <button
            type="button"
            role="switch"
            aria-checked={picked}
            onClick={() => setPicked(!picked)}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] ${
              picked
                ? 'border-primary/35 bg-primary/10 text-primary'
                : 'border-hairline bg-canvas text-muted hover:text-ink'
            }`}
          >
            <span
              aria-hidden
              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border transition-colors ${
                picked
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-hairline-strong bg-canvas'
              }`}
            >
              {picked ? <Check size={10} weight="bold" /> : null}
            </span>
            仅精选
          </button>
          <FeedSearch
            basePath={target}
            placeholder="搜索标题、摘要、来源或标签…"
            className="min-w-0 flex-1"
          />
        </div>
      </div>
    </div>
  );
}
