import type { Topic } from '../../domain/types';

/** Client-side topic title search (api server search deferred per GAPS §C.50). */
export async function searchTopicsByKeyword(keyword: string, topics: Topic[]): Promise<Topic[]> {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  return topics.filter((topic) => topic.title.toLowerCase().includes(q));
}
