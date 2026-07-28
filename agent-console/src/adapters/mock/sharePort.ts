import type { TopicShareInfo } from '../../domain/types';
import type { ISharePort } from '../ports/ISharePort';
import { getMockShareByTopicId } from './seeds/shareSeed';
import { makeShareId } from '../shareUtils';

export const mockSharePort: ISharePort = {
  async getShareByTopicId() {
    return getMockShareByTopicId();
  },

  async getShare(topicId) {
    return getMockShareByTopicId()[topicId] ?? null;
  },

  async updateVisibility(topicId, visibility) {
    await new Promise((r) => window.setTimeout(r, 80));
    const seed = getMockShareByTopicId();
    const existing = seed[topicId];
    const base: TopicShareInfo = existing ?? {
      topicId,
      shareId: makeShareId(topicId),
      visibility: 'private',
    };
    return { ...base, visibility };
  },
};
