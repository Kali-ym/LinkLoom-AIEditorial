import type { Message } from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';

export interface SendMessageInput {
  topicId: string;
  text: string;
  threadId?: string;
}

export interface IChatPort {
  getMessagesByTopicId(): Promise<Record<string, Message[]>>;
  getMessages(topicId: string): Promise<Message[]>;
  sendMessage(input: SendMessageInput): Promise<Message>;
  editMessage(topicId: string, messageId: string, payload: UserTurnPayload): Promise<Message>;
  regenerateMessage(topicId: string, messageId: string): Promise<Message>;
}
