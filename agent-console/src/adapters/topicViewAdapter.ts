import type { Topic } from '../domain/types';
import type { TopicViewItem } from '../domain/types/topicView';

const TRIGGERS = ['chat', 'api', 'task', 'eval'] as const;

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** §C.53 — mock withDetails enrichment from sidebar Topic */
export function enrichTopicForView(topic: Topic, index: number): TopicViewItem {
  const seed = hashSeed(topic.id || String(index));
  const trigger = TRIGGERS[seed % TRIGGERS.length];
  const messageCount = (seed % 24) + 1;
  const viewStatus =
    topic.status === 'completed'
      ? 'completed'
      : topic.status === 'running'
        ? 'running'
        : topic.status === 'temp'
          ? 'active'
          : 'active';

  return {
    ...topic,
    trigger,
    messageCount,
    description: topic.workingDirectory
      ? `工作目录：${topic.workingDirectory}`
      : `共 ${messageCount} 条消息`,
    historySummary: `最近讨论：${topic.title}`,
    firstUserMessage: `关于「${topic.title}」的对话`,
    cost: Number(((seed % 500) / 100).toFixed(2)),
    viewStatus,
  };
}

export function enrichTopicsForView(topics: Topic[]): TopicViewItem[] {
  return topics
    .filter((t) => t.status !== 'temp' && t.id)
    .map((topic, index) => enrichTopicForView(topic, index));
}
