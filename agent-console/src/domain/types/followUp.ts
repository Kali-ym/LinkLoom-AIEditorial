export interface FollowUpChip {
  label: string;
  message: string;
}

export interface FollowUpFetchParams {
  conversationKey: string;
  messageId: string;
  topicId: string;
  threadId?: string;
}
