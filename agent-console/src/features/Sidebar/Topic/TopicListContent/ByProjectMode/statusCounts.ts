import type { Topic } from '../../../../../domain/types/topic';

export interface ProjectTopicStatusCounts {
  failed: number;
  loading: number;
  waitingForHuman: number;
}

export const EMPTY_PROJECT_TOPIC_STATUS_COUNTS: ProjectTopicStatusCounts = {
  failed: 0,
  loading: 0,
  waitingForHuman: 0,
};

/** §C.44*/
export function getProjectTopicStatusCounts(
  topics: Topic[],
  loadingTopicIds: ReadonlySet<string>,
): ProjectTopicStatusCounts {
  return topics.reduce<ProjectTopicStatusCounts>(
    (counts, topic) => {
      if (topic.status === 'waiting') {
        counts.waitingForHuman += 1;
        return counts;
      }
      if (loadingTopicIds.has(topic.id) || topic.status === 'running') {
        counts.loading += 1;
        return counts;
      }
      if (topic.status === 'failed') {
        counts.failed += 1;
      }
      return counts;
    },
    { ...EMPTY_PROJECT_TOPIC_STATUS_COUNTS },
  );
}

export function hasProjectTopicStatusCounts(counts: ProjectTopicStatusCounts): boolean {
  return counts.loading > 0 || counts.waitingForHuman > 0 || counts.failed > 0;
}
