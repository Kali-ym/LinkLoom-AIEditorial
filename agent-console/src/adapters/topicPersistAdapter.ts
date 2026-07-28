import type { TopicImportPayload } from './topicImportAdapter';
import { generateTopicId } from '../services/topic/topicId';

/** §C.55 / §C.52 — topic persist mock; replace with REST */
export async function saveTopicSnapshot(topicId: string): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 180));
  void topicId;
}

export async function renameTopicApi(topicId: string, title: string): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 120));
  void topicId;
  void title;
}

export async function persistImportedTopic(
  payload: TopicImportPayload,
  fileName: string,
): Promise<{ id: string; title: string }> {
  await new Promise((r) => window.setTimeout(r, 240));
  const title = payload.title?.trim() || fileName.replace(/\.json$/i, '') || '导入的话题';
  return { id: generateTopicId(), title };
}
