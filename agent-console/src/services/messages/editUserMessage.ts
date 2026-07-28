import { getAgentConsolePorts, isAgentConsoleApiMode } from '../../adapters/registry';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import { syncTopicMessagesQuery } from '../../hooks/data/messagesQuerySync';
import { useChatStore } from '../../stores/chatStore';
import { showToast } from '../ui/toast';

/** Optimistic local edit; persists via chat port in API mode. */
export async function editUserMessage(
  topicId: string,
  messageId: string,
  payload: UserTurnPayload,
): Promise<void> {
  useChatStore.getState().updateUserMessage(topicId, messageId, payload);

  if (!isAgentConsoleApiMode()) return;

  try {
    const updated = await getAgentConsolePorts().chat.editMessage(topicId, messageId, payload);
    const prev = useChatStore.getState().messagesByTopicId[topicId] ?? [];
    const newMessages = prev.map((msg) =>
      msg.id === messageId ? { ...msg, ...updated, role: 'user' as const } : msg,
    );
    syncTopicMessagesQuery(topicId, newMessages);
    useChatStore.getState().setMessages(topicId, newMessages);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存消息失败');
  }
}
