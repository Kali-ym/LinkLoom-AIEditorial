import type { TopicViewItem, TopicViewGroup } from '../../domain/types/topicView';
import type { SortBy, StatusFilter, TimeRangeFilter } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function matchesStatus(topic: TopicViewItem, status: StatusFilter): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'archived':
      return topic.viewStatus === 'archived';
    case 'completed':
      return topic.status === 'completed';
    case 'running':
      return topic.status === 'running';
    case 'pending':
      return (
        topic.status === 'waiting' ||
        topic.status === 'failed' ||
        topic.status === 'unread'
      );
    default:
      return true;
  }
}

export function matchesGroup(topic: TopicViewItem, groupIds: string[]): boolean {
  if (groupIds.length === 0) return true;
  const project = topic.workingDirectory ?? '';
  return groupIds.includes(project);
}

export function matchesTimeRange(topic: TopicViewItem, range: TimeRangeFilter): boolean {
  if (range === 'all') return true;
  const updated = topic.updatedAt ? new Date(topic.updatedAt).getTime() : 0;
  if (!updated) return false;
  const diff = Date.now() - updated;
  if (range === 'today') return diff < DAY_MS;
  if (range === 'week') return diff < 7 * DAY_MS;
  if (range === 'month') return diff < 30 * DAY_MS;
  return true;
}

export function sortTopicsView(topics: TopicViewItem[], sortBy: SortBy): TopicViewItem[] {
  const sorted = [...topics];
  if (sortBy === 'title') {
    sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    return sorted;
  }
  const field = sortBy === 'createdAt' ? 'createdAt' : 'updatedAt';
  sorted.sort(
    (a, b) => new Date(b[field] ?? 0).getTime() - new Date(a[field] ?? 0).getTime(),
  );
  return sorted;
}

export function getProjectLabel(topic: TopicViewItem): string | undefined {
  const wd = topic.workingDirectory;
  if (!wd) return undefined;
  const parts = wd.split('/').filter(Boolean);
  return parts.at(-1) ?? wd;
}

function getTimeBucket(updatedAt?: string): string {
  if (!updatedAt) return 'earlier';
  const diff = Date.now() - new Date(updatedAt).getTime();
  if (diff < DAY_MS) return 'today';
  if (diff < 2 * DAY_MS) return 'yesterday';
  if (diff < 7 * DAY_MS) return 'week';
  if (diff < 30 * DAY_MS) return 'month';
  return 'earlier';
}

const TIME_LABELS: Record<string, string> = {
  today: '今天',
  yesterday: '昨天',
  week: '本周',
  month: '本月',
  earlier: '更早',
};

export function groupTopicsByUpdatedTime(topics: TopicViewItem[]): TopicViewGroup[] {
  const buckets = new Map<string, TopicViewItem[]>();
  for (const topic of topics) {
    const key = getTimeBucket(topic.updatedAt);
    const list = buckets.get(key) ?? [];
    list.push(topic);
    buckets.set(key, list);
  }
  const order = ['today', 'yesterday', 'week', 'month', 'earlier'];
  return order
    .filter((id) => buckets.has(id))
    .map((id) => ({
      id,
      title: TIME_LABELS[id],
      children: buckets.get(id) ?? [],
    }));
}

export function groupTopicsByProject(topics: TopicViewItem[]): TopicViewGroup[] {
  const buckets = new Map<string, TopicViewItem[]>();
  for (const topic of topics) {
    const key = topic.workingDirectory || 'no-project';
    const list = buckets.get(key) ?? [];
    list.push(topic);
    buckets.set(key, list);
  }
  return [...buckets.entries()].map(([id, children]) => ({
    id,
    title: id === 'no-project' ? '无项目' : getProjectLabel(children[0]) ?? id,
    children,
  }));
}

export function getTimeGroupTitle(id: string): string {
  return TIME_LABELS[id] ?? id;
}

export function getProjectGroupTitle(id: string, sample?: TopicViewItem): string {
  if (id === 'no-project') return '无项目';
  return getProjectLabel(sample ?? { id: '', title: '', status: 'completed', workingDirectory: id }) ?? id;
}
