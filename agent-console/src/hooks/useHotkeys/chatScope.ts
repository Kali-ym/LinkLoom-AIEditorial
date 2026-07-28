import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { agentConsoleChatPath, isAgentSubRoute } from '../../constants/agentConsoleRoutes';
import { useRouteAgentId } from '../../hooks/useRouteAgentId';
import { HotkeyScopeEnum } from '../../constants/hotkeyRegistry';
import { regenerateUserMessage } from '../../services/streaming/sendMessage';
import { isActiveTopicStreaming } from '../../services/streaming/streamingScope';
import { showToast } from '../../services/ui/toast';
import { useChatStore, useLayoutStore, useTopicStore } from '../../stores';
import { useOpenChatSettings } from '../useOpenChatSettings';
import { useHotkeysContext } from './HotkeysProvider';
import { useHotkeyById } from './useHotkeyById';

function isStreamingActive(): boolean {
  return isActiveTopicStreaming();
}

function getActiveTopicId(): string {
  return useTopicStore.getState().activeTopicId;
}

function getLastMessageId(topicId: string): string | undefined {
  const messages = useChatStore.getState().getMessages(topicId);
  return messages[messages.length - 1]?.id;
}

function getLastUserMessageId(topicId: string): string | undefined {
  const messages = useChatStore.getState().getMessages(topicId);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i].id;
  }
  return undefined;
}

/** §C.55*/
function useConversationHotkeys(): void {
  const streamingGuard = useCallback(() => {
    if (isStreamingActive()) {
      showToast('请等待当前回复完成');
      return false;
    }
    return true;
  }, []);

  useHotkeyById(
    'regenerateMessage',
    () => {
      if (!streamingGuard()) return;
      const topicId = getActiveTopicId();
      const userId = getLastUserMessageId(topicId);
      if (!userId) return;
      void regenerateUserMessage(topicId, userId);
    },
    { enableOnContentEditable: true, enabled: () => !isStreamingActive() },
  );

  useHotkeyById(
    'deleteLastMessage',
    () => {
      if (!streamingGuard()) return;
      const topicId = getActiveTopicId();
      const lastId = getLastMessageId(topicId);
      if (!lastId) return;
      useChatStore.getState().deleteMessage(topicId, lastId);
    },
    { enableOnContentEditable: true, enabled: () => !isStreamingActive() },
  );

  useHotkeyById(
    'deleteAndRegenerateMessage',
    () => {
      if (!streamingGuard()) return;
      const topicId = getActiveTopicId();
      const messages = useChatStore.getState().getMessages(topicId);
      const last = messages[messages.length - 1];
      if (!last) return;
      if (last.role === 'user') {
        void regenerateUserMessage(topicId, last.id);
        return;
      }
      useChatStore.getState().deleteMessage(topicId, last.id);
      const userId = getLastUserMessageId(topicId);
      if (userId) void regenerateUserMessage(topicId, userId);
    },
    { enableOnContentEditable: true, enabled: () => !isStreamingActive() },
  );
}

/** §C.55*/
export function useRegisterChatHotkeys(): void {
  const navigate = useNavigate();
  const agentId = useRouteAgentId();
  const openChatSettings = useOpenChatSettings();
  const toggleZenMode = useLayoutStore((s) => s.toggleZenMode);
  const openNewTopicOrSaveTopic = useTopicStore((s) => s.openNewTopicOrSaveTopic);
  const { enableScope, disableScope } = useHotkeysContext();

  useHotkeyById('openChatSettings', () => openChatSettings());
  useHotkeyById('toggleZenMode', () => toggleZenMode(), { enableOnContentEditable: true });
  useHotkeyById(
    'saveTopic',
    () => {
      if (isAgentSubRoute(window.location.pathname)) {
        if (agentId) navigate(agentConsoleChatPath(agentId));
      }
      openNewTopicOrSaveTopic();
    },
    { enableOnContentEditable: true },
  );

  useConversationHotkeys();

  useEffect(() => {
    enableScope(HotkeyScopeEnum.Chat);
    return () => disableScope(HotkeyScopeEnum.Chat);
  }, [disableScope, enableScope]);
}

export function useAddUserMessageHotkey(send: () => void): void {
  useHotkeyById('addUserMessage', () => send(), { enableOnContentEditable: true });
}
