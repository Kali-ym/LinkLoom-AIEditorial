import type { TopicShareInfo } from '../../../domain/types';

export function getMockShareByTopicId(): Record<string, TopicShareInfo> {
  return {
    skills: { topicId: 'skills', shareId: 'share-skills-demo', visibility: 'private' },
    changelog: { topicId: 'changelog', shareId: 'share-changelog', visibility: 'link' },
  };
}
