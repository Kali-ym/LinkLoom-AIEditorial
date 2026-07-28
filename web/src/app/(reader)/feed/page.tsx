import { Suspense } from 'react';
import { fetchTimeline } from '@/lib/api';
import { ContentPanel } from '@/components/ContentPanel';
import { FeedHeader } from '@/components/FeedHeader';
import { FeedEventBanner } from '@/components/feed/FeedEventBanner';
import { FeedFilters } from '@/components/feed/FeedFilters';
import { FeedTableFeed } from '@/components/feed/FeedTableFeed';
import { FeedTableSkeleton } from '@/components/feed/FeedTable';
import { TIMELINE_INITIAL_LIMIT } from '@/lib/timelineConfig';

export const metadata = { title: '信息流' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: Promise<{
    picked?: string;
    category?: string;
    topic?: string;
    includeTags?: string;
    excludeTags?: string;
    q?: string;
    search?: string;
    event?: string;
  }>;
}

function parseTagList(raw?: string): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const tags = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
}

function clearEventHref(params: {
  picked?: string;
  category?: string;
  topic?: string;
  includeTags?: string;
  excludeTags?: string;
  q?: string;
  search?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.picked === '1') sp.set('picked', '1');
  if (params.category?.trim()) sp.set('category', params.category.trim());
  if (params.topic?.trim()) sp.set('topic', params.topic.trim());
  if (params.includeTags?.trim()) sp.set('includeTags', params.includeTags.trim());
  if (params.excludeTags?.trim()) sp.set('excludeTags', params.excludeTags.trim());
  const q = (params.q ?? params.search)?.trim();
  if (q) sp.set('q', q);
  const qs = sp.toString();
  return qs ? `/feed?${qs}` : '/feed';
}

export default async function FeedPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const picked = params.picked === '1';
  const category = params.category?.trim() || undefined;
  const topic = params.topic?.trim() || undefined;
  const includeTags = parseTagList(params.includeTags);
  const excludeTags = parseTagList(params.excludeTags);
  const search = (params.q ?? params.search)?.trim() || undefined;
  const event = params.event?.trim() || undefined;

  const initial = await fetchTimeline({
    picked: picked || undefined,
    category,
    topic,
    includeTags,
    excludeTags,
    search,
    event,
    limit: TIMELINE_INITIAL_LIMIT
  });

  return (
    <ContentPanel>
      <Suspense>
        <FeedHeader
          title="信息流"
          description="可筛选的 AI 时间线：按精选、分类与话题浏览官方发布、研究与行业讨论。"
          toolbarExtra={
            <Suspense>
              <FeedFilters basePath="/feed" />
            </Suspense>
          }
        />
      </Suspense>
      {initial.context ? (
        <FeedEventBanner
          title={initial.context.title}
          onClearHref={clearEventHref(params)}
        />
      ) : null}
      <Suspense fallback={<FeedTableSkeleton rows={8} />}>
        <FeedTableFeed
          initial={initial}
          query={{
            picked: picked || undefined,
            category,
            includeTags,
            excludeTags,
            search,
            event
          }}
        />
      </Suspense>
    </ContentPanel>
  );
}
