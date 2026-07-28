import type { ShareVisibility, TopicShareInfo } from '../../domain/types';

export interface ISharePort {
  getShareByTopicId(): Promise<Record<string, TopicShareInfo>>;
  getShare(topicId: string): Promise<TopicShareInfo | null>;
  updateVisibility(topicId: string, visibility: ShareVisibility): Promise<TopicShareInfo>;
}
