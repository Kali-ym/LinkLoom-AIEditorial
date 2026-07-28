import type { Topic } from '../../../domain/types';
import type { TopicGroupMode, TopicSortBy } from '../../../stores/types';
import { topicGroupStrings } from './topicGroupStrings';

export interface TopicGroup {
  id: string;
  label: string;
  topics: Topic[];
  /** byProject — raw working directory path */
  workingDirectory?: string;
}

export const PROJECT_GROUP_PREFIX = 'project:';
export const NO_PROJECT_GROUP_ID = 'no-project';

export type TopicStatusBucket =
  | 'pending'
  | 'running'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export const STATUS_GROUP_ORDER: TopicStatusBucket[] = [
  'pending',
  'running',
  'active',
  'paused',
  'completed',
  'archived',
];

const MS_DAY = 86_400_000;

export function splitTempTopics(topics: Topic[]) {
  return {
    tempTopics: topics.filter((t) => t.status === 'temp' || !t.id),
    rest: topics.filter((t) => t.status !== 'temp' && t.id),
  };
}

/** Topics pinned above grouped accordion (draft / not yet on server list). */
export function collectPinnedSidebarTopics(topics: Topic[]): Topic[] {
  return topics.filter((t) => t.status === 'temp' || !t.id);
}

export function isOptimisticSidebarTopic(
  topic: Topic,
  serverTopicIds: ReadonlySet<string>,
  options?: { hasLocalMessages?: boolean; isStreaming?: boolean },
): boolean {
  if (serverTopicIds.has(topic.id)) return false;
  if (topic.status === 'temp' || !topic.id) return true;
  if (topic.status === 'running' || topic.status === 'waiting' || topic.status === 'failed') {
    return true;
  }
  if (options?.isStreaming) return true;
  if (options?.hasLocalMessages) return true;
  return false;
}

export function mergeTopicListWithOptimistic(
  localTopics: Topic[],
  serverTopics: Topic[],
  activeTopicId: string,
  options?: {
    streamingTopicIds?: ReadonlySet<string>;
    messagesByTopicId?: Record<string, unknown[]>;
    sortBy?: TopicSortBy;
  },
): Topic[] {
  const serverById = new Map(serverTopics.map((topic) => [topic.id, topic]));
  const serverIds = new Set(serverById.keys());
  const sortBy = options?.sortBy ?? 'updatedAt';
  const streamingTopicIds = options?.streamingTopicIds ?? new Set<string>();
  const messagesByTopicId = options?.messagesByTopicId ?? {};

  const optimistic = localTopics.filter((topic) =>
    isOptimisticSidebarTopic(topic, serverIds, {
      hasLocalMessages: (messagesByTopicId[topic.id]?.length ?? 0) > 0,
      isStreaming: streamingTopicIds.has(topic.id),
    }),
  );

  const merged: Topic[] = [];
  const seen = new Set<string>();

  for (const topic of optimistic) {
    if (seen.has(topic.id)) continue;
    merged.push({ ...topic, active: topic.id === activeTopicId });
    seen.add(topic.id);
  }

  for (const topic of serverTopics) {
    if (seen.has(topic.id)) continue;
    merged.push({ ...topic, active: topic.id === activeTopicId });
    seen.add(topic.id);
  }

  return sortTopics(merged, sortBy);
}

function getTopicTimestamp(topic: Topic, field: 'createdAt' | 'updatedAt'): number {
  const raw = field === 'updatedAt' ? topic.updatedAt : topic.createdAt ?? topic.updatedAt;
  if (raw) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (topic.group === 'yesterday') return Date.now() - MS_DAY;
  if (topic.group === 'earlier') return Date.now() - MS_DAY * 14;
  const numeric = Number.parseInt(topic.id.replace(/\D/g, ''), 10);
  return numeric > 0 ? numeric : 0;
}

export function sortTopics(topics: Topic[], sortBy: TopicSortBy): Topic[] {
  return [...topics].sort((a, b) => {
    if (sortBy === 'updatedAt') {
      return getTopicTimestamp(b, 'updatedAt') - getTopicTimestamp(a, 'updatedAt');
    }
    return getTopicTimestamp(b, 'createdAt') - getTopicTimestamp(a, 'createdAt');
  });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterdayDate(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(date, yesterday);
}

function getTopicTimeGroupId(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  if (isSameCalendarDay(date, now)) return 'today';
  if (isYesterdayDate(date, now)) return 'yesterday';

  const weekAgo = now.getTime() - 7 * MS_DAY;
  if (timestamp > weekAgo && !isSameCalendarDay(date, now) && !isYesterdayDate(date, now)) {
    return 'week';
  }

  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    return 'month';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  return `${date.getFullYear()}`;
}

function sortTimeGroups(groups: TopicGroup[]): TopicGroup[] {
  const orderMap = new Map<string, number>([
    ['today', 0],
    ['yesterday', 1],
    ['week', 2],
    ['month', 3],
  ]);
  return [...groups].sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== Number.MAX_SAFE_INTEGER || orderB !== Number.MAX_SAFE_INTEGER) {
      return orderA - orderB;
    }
    return b.id.localeCompare(a.id);
  });
}

function groupTopicsByTimeField(topics: Topic[], field: 'createdAt' | 'updatedAt'): TopicGroup[] {
  if (!topics.length) return [];
  const sorted = sortTopics(topics, field === 'updatedAt' ? 'updatedAt' : 'createdAt');
  const buckets = new Map<string, Topic[]>();
  for (const topic of sorted) {
    const groupId = getTopicTimeGroupId(getTopicTimestamp(topic, field));
    const list = buckets.get(groupId) ?? [];
    list.push(topic);
    buckets.set(groupId, list);
  }
  return sortTimeGroups(
    [...buckets.entries()].map(([id, groupTopics]) => ({
      id,
      label: '',
      topics: groupTopics,
    })),
  );
}

function resolveStatusBucket(
  topic: Topic,
  loadingTopicIds: ReadonlySet<string>,
  unreadTopicIds: ReadonlySet<string>,
): TopicStatusBucket {
  if (topic.status === 'waiting' || topic.status === 'failed') return 'pending';
  if (unreadTopicIds.has(topic.id) || topic.status === 'unread') return 'pending';
  if (loadingTopicIds.has(topic.id) || topic.status === 'running') return 'running';
  if (topic.status === 'completed') return 'completed';
  if (topic.status === 'platform') return 'active';
  return 'active';
}

function groupTopicsByStatus(
  topics: Topic[],
  sortBy: TopicSortBy,
  loadingTopicIds: ReadonlySet<string>,
  unreadTopicIds: ReadonlySet<string>,
): TopicGroup[] {
  if (!topics.length) return [];
  const buckets = new Map<TopicStatusBucket, Topic[]>();
  for (const topic of topics) {
    const id = resolveStatusBucket(topic, loadingTopicIds, unreadTopicIds);
    const list = buckets.get(id) ?? [];
    list.push(topic);
    buckets.set(id, list);
  }
  const field = sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
  return STATUS_GROUP_ORDER.filter((status) => buckets.has(status)).map((status) => ({
    id: status,
    label: topicGroupStrings.byStatus[status],
    topics: sortTopics(buckets.get(status) ?? [], sortBy).sort(
      (a, b) => getTopicTimestamp(b, field) - getTopicTimestamp(a, field),
    ),
  }));
}

function normalizeWorkingDirectory(dir: string): string {
  return dir.replace(/[/\\]+$/, '').trim();
}

function groupTopicsByProject(topics: Topic[], sortBy: TopicSortBy): TopicGroup[] {
  if (!topics.length) return [];
  const buckets = new Map<string, { path: string; topics: Topic[] }>();
  for (const topic of topics) {
    const raw = topic.workingDirectory?.trim() ?? '';
    const normalized = raw ? normalizeWorkingDirectory(raw) : '';
    const id = normalized ? `${PROJECT_GROUP_PREFIX}${normalized}` : NO_PROJECT_GROUP_ID;
    const existing = buckets.get(id);
    if (existing) {
      existing.topics.push(topic);
    } else {
      buckets.set(id, { path: normalized, topics: [topic] });
    }
  }
  const field = sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
  const groups = [...buckets.entries()].map(([id, { path, topics: groupTopics }]) => ({
    id,
    label: id === NO_PROJECT_GROUP_ID ? topicGroupStrings.noProject : getDirName(path),
    topics: sortTopics(groupTopics, sortBy).sort(
      (a, b) => getTopicTimestamp(b, field) - getTopicTimestamp(a, field),
    ),
    workingDirectory: id === NO_PROJECT_GROUP_ID ? undefined : path,
  }));
  return groups.sort((a, b) => {
    if (a.id === NO_PROJECT_GROUP_ID) return 1;
    if (b.id === NO_PROJECT_GROUP_ID) return -1;
    const aTime = getTopicTimestamp(a.topics[0], field);
    const bTime = getTopicTimestamp(b.topics[0], field);
    return bTime - aTime;
  });
}

export function buildGroupedTopics(
  topics: Topic[],
  groupFn: (items: Topic[]) => TopicGroup[],
): TopicGroup[] {
  const favTopics = topics.filter((t) => t.fav || t.tag === 'fav');
  const unfavTopics = topics.filter((t) => !t.fav && t.tag !== 'fav');
  if (favTopics.length === 0) return groupFn(topics);
  return [
    {
      id: 'favorite',
      label: topicGroupStrings.favorite,
      topics: favTopics,
    },
    ...groupFn(unfavTopics),
  ];
}

export interface GroupTopicsOptions {
  loadingTopicIds?: ReadonlySet<string>;
  sortBy?: TopicSortBy;
  unreadTopicIds?: ReadonlySet<string>;
}

export function groupTopicsByMode(
  topics: Topic[],
  mode: TopicGroupMode,
  options: GroupTopicsOptions = {},
): TopicGroup[] {
  const { rest } = splitTempTopics(topics);
  const sortBy = options.sortBy ?? 'updatedAt';
  const loadingTopicIds = options.loadingTopicIds ?? new Set<string>();
  const unreadTopicIds = options.unreadTopicIds ?? new Set<string>();

  if (mode === 'flat') {
    return rest.length ? [{ id: 'flat', label: '', topics: rest }] : [];
  }

  if (mode === 'byStatus') {
    return buildGroupedTopics(rest, (items) =>
      groupTopicsByStatus(items, sortBy, loadingTopicIds, unreadTopicIds),
    );
  }

  if (mode === 'byProject') {
    return buildGroupedTopics(rest, (items) => groupTopicsByProject(items, sortBy));
  }

  const timeField = sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
  return buildGroupedTopics(rest, (items) => groupTopicsByTimeField(items, timeField));
}

export function getDirName(path: string) {
  const parts = path.split(/[/\\]+/).filter(Boolean);
  return parts[parts.length - 1] || path;
}
