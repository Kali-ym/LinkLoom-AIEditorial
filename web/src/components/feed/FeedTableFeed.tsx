'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FeedTable, FeedTableSkeleton } from '@/components/feed/FeedTable';
import type { TimelineContext, TimelineFeedItem, TimelineResponse } from '@/lib/types';
import { TIMELINE_INITIAL_LIMIT, TIMELINE_PAGE_SIZE } from '@/lib/timelineConfig';

interface FeedQuery {
  picked?: boolean;
  category?: string;
  topic?: string;
  includeTags?: string[];
  excludeTags?: string[];
  sourceType?: string;
  search?: string;
  event?: string;
}

interface Props {
  initial: TimelineResponse;
  query?: FeedQuery;
  pollIntervalMs?: number;
}

async function fetchTimelinePage(
  queryStr: string,
  opts: { cursor?: string | null; limit: number }
): Promise<TimelineResponse | null> {
  const q = new URLSearchParams(queryStr);
  q.set('limit', String(opts.limit));
  if (opts.cursor) q.set('cursor', opts.cursor);
  try {
    const res = await fetch(`/api/feed/timeline?${q.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function hasActiveFilters(query: FeedQuery): boolean {
  return Boolean(
    query.picked ||
      query.category ||
      query.topic ||
      query.includeTags?.length ||
      query.excludeTags?.length ||
      query.sourceType ||
      (query.search && query.search.trim()) ||
      query.event
  );
}

export function FeedTableFeed({ initial, query = {}, pollIntervalMs = 60_000 }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<TimelineFeedItem[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [total, setTotal] = useState(initial.total);
  const [context, setContext] = useState<TimelineContext | null | undefined>(initial.context);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const queryStr = useMemo(() => {
    const q = new URLSearchParams();
    if (query.picked) q.set('picked', '1');
    if (query.category) q.set('category', query.category);
    if (query.topic) q.set('topic', query.topic);
    if (query.includeTags?.length) q.set('includeTags', query.includeTags.join(','));
    if (query.excludeTags?.length) q.set('excludeTags', query.excludeTags.join(','));
    if (query.sourceType) q.set('sourceType', query.sourceType);
    if (query.search && query.search.trim()) q.set('search', query.search.trim());
    if (query.event && query.event.trim()) q.set('event', query.event.trim());
    return q.toString();
  }, [
    query.picked,
    query.category,
    query.topic,
    query.includeTags?.join(','),
    query.excludeTags?.join(','),
    query.sourceType,
    query.search,
    query.event
  ]);

  useEffect(() => {
    setItems(initial.items);
    setCursor(initial.nextCursor);
    setTotal(initial.total);
    setContext(initial.context);
    setError(null);
  }, [initial.items, initial.nextCursor, initial.total, initial.context, queryStr]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTimelinePage(queryStr, { cursor, limit: TIMELINE_PAGE_SIZE });
      if (!res) {
        setError('加载失败，请重试。');
        return;
      }
      if (res.items.length) {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
        });
      }
      setCursor(res.nextCursor);
      if (typeof res.total === 'number') setTotal(res.total);
      if (res.context !== undefined) setContext(res.context);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, queryStr]);

  useEffect(() => {
    const refresh = async () => {
      const res = await fetchTimelinePage(queryStr, { limit: TIMELINE_INITIAL_LIMIT });
      if (!res?.items?.length) return;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...res.items.filter((i) => !seen.has(i.id)), ...prev];
        return merged.slice(0, 200);
      });
      if (typeof res.total === 'number') setTotal(res.total);
      if (res.context !== undefined) setContext(res.context);
    };
    const t = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(t);
  }, [queryStr, pollIntervalMs]);

  useEffect(() => {
    if (!cursor) return;
    const node = sentinelRef.current;
    if (!node) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { rootMargin: '200px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  const showHotBadge = Boolean(query.event && context);

  if (loading && items.length === 0) {
    return (
      <div className="py-4">
        <FeedTableSkeleton rows={8} />
      </div>
    );
  }

  if (items.length === 0) {
    if (error) {
      return (
        <div className="px-5 py-20 text-center sm:px-8">
          <div className="mx-auto max-w-md">
            <p className="font-display text-3xl tracking-[-0.03em] text-ink">加载失败</p>
            <p className="mt-2 text-muted">{error}</p>
            <p className="mt-4">
              <button
                type="button"
                className="text-sm font-medium text-primary transition-colors hover:text-primary-active"
                onClick={() => {
                  setError(null);
                  router.refresh();
                }}
              >
                重试
              </button>
            </p>
          </div>
        </div>
      );
    }
    const filtered = hasActiveFilters(query);
    return (
      <div className="px-5 py-20 text-center sm:px-8">
        <div className="mx-auto max-w-md">
          <p className="font-display text-3xl tracking-[-0.03em] text-ink">没有符合条件的条目</p>
          <p className="mt-2 text-muted">
            {filtered ? '试试调整筛选条件，或清除后重新浏览。' : '内容正在更新，请稍后再来。'}
          </p>
          {filtered && (
            <p className="mt-4">
              <Link
                href="/feed"
                className="text-sm font-medium text-primary transition-colors hover:text-primary-active"
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/feed');
                }}
              >
                清除筛选
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  const hasMore = Boolean(cursor);

  return (
    <div className="pb-6">
      <FeedTable items={items} showHotBadge={showHotBadge} />

      <div ref={sentinelRef} className="flex flex-col items-center gap-2 px-5 py-10 sm:px-8">
        {error ? (
          <>
            <p className="text-sm text-muted">{error}</p>
            <button type="button" onClick={() => void loadMore()} className="btn-primary h-11 px-6">
              重试
            </button>
          </>
        ) : loading ? (
          <span className="text-sm text-muted">加载中…</span>
        ) : hasMore ? (
          <>
            <button type="button" onClick={() => void loadMore()} className="btn-primary h-11 px-6">
              加载更多
            </button>
            <span className="text-xs text-muted">
              已显示 {items.length}
              {total ? ` / ${total}` : ''} 条
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">— 已经到底 —</span>
        )}
      </div>
    </div>
  );
}
