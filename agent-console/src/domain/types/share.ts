export type ShareVisibility = 'private' | 'link';

export interface TopicShareInfo {
  topicId: string;
  shareId: string;
  visibility: ShareVisibility;
}
