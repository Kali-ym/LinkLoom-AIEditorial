import { shanghaiDateKey } from './format';

export type FeedDateGroup<T extends { id: string; publishedAt: string }> = {
  dateKey: string;
  items: T[];
};

export function groupFeedItemsByShanghaiDate<T extends { id: string; publishedAt: string }>(
  items: T[]
): FeedDateGroup<T>[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const key = shanghaiDateKey(item.publishedAt);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }

  return order.map((dateKey) => ({
    dateKey,
    items: buckets.get(dateKey)!
  }));
}
