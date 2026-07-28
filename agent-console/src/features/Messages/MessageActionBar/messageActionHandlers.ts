import { forkTopicFromMessage } from '../../../services/topic/forkTopic';
import { quoteMessageIntoInput } from '../../../services/messages/quoteMessageIntoInput';
import { isTopicStreaming } from '../../../services/streaming/streamingScope';
import { showToast } from '../../../services/ui/toast';
import { messageActionStrings } from './messageActionStrings';

export async function copyMessageText(plainText: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(plainText);
    showToast(messageActionStrings.copySuccess);
  } catch {
    showToast(messageActionStrings.copyFail);
  }
}

export function quoteMessageText(plainText: string): void {
  if (!plainText.trim()) {
    showToast(messageActionStrings.quoteEmpty);
    return;
  }
  if (quoteMessageIntoInput(plainText)) {
    showToast(messageActionStrings.quoteSuccess);
  }
}

export function forkTopicAtMessage(topicId: string, messageId: string): void {
  if (isTopicStreaming(topicId)) {
    showToast(messageActionStrings.regenerateWait);
    return;
  }
  const newTopicId = forkTopicFromMessage(topicId, messageId);
  if (newTopicId) {
    showToast(messageActionStrings.forkTopicCreated);
    return;
  }
  showToast(messageActionStrings.forkTopicEmpty);
}
