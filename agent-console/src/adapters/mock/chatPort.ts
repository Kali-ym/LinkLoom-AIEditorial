import type { IChatPort, SendMessageInput } from '../ports/IChatPort';
import type { Message } from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import { mapRefsToMessageAttachments } from '../../utils/userTurnAttachments';
import { getMockMessagesByTopicId } from './seeds/chatSeed';

export const mockChatPort: IChatPort = {
  async getMessagesByTopicId() {
    return getMockMessagesByTopicId();
  },

  async getMessages(topicId) {
    return getMockMessagesByTopicId()[topicId] ?? [];
  },

  async sendMessage(input: SendMessageInput): Promise<Message> {
    await new Promise((r) => window.setTimeout(r, 80));
    return {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.text,
      createdAt: new Date().toISOString(),
      threadId: input.threadId,
    };
  },

  async editMessage(topicId, messageId, payload: UserTurnPayload) {
    await new Promise((r) => window.setTimeout(r, 80));
    const existing = getMockMessagesByTopicId()[topicId]?.find((m) => m.id === messageId);
    const refs = payload.files?.map((file) => ({
      uploadId: file.fileId,
      fileId: file.fileId,
      name: file.name ?? file.fileId,
      mime: file.mimeType ?? 'application/octet-stream',
      url: file.url ?? '',
      size: file.size ?? 0,
    })) ?? [];
    const { fileList, imageList } = mapRefsToMessageAttachments(refs);
    return {
      ...(existing ?? { id: messageId, role: 'user', createdAt: new Date().toISOString() }),
      content: payload.message,
      text: payload.message,
      editorData: payload.editorData,
      fileList,
      imageList,
    };
  },

  async regenerateMessage(topicId, messageId) {
    await new Promise((r) => window.setTimeout(r, 120));
    const existing = getMockMessagesByTopicId()[topicId]?.find((m) => m.id === messageId);
    return (
      existing ?? {
        id: messageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
    );
  },
};
