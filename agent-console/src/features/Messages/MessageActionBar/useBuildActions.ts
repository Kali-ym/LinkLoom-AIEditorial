import { useMemo } from 'react';
import {
  Copy,
  Edit,
  Languages,
  ListChevronsDownUp,
  ListChevronsUpDown,
  ListRestart,
  Play,
  RotateCcw,
  Share2,
  Split,
  StepForward,
  Trash,
} from 'lucide-react';

import { useChatStore } from '../../../stores/chatStore';
import { showToast } from '../../../services/ui/toast';
import { getMessagePlainText } from '../../../utils/messagePlainText';
import { regenerateAssistantMessage, regenerateUserMessage } from '../../../services/streaming/sendMessage';
import { isAgentConsoleApiMode } from '../../../adapters/registry';
import { isTopicStreaming } from '../../../services/streaming/streamingScope';
import { openShareModal } from '../../ShareModal';
import { runOrDefer } from '../../shared/deferActions';
import { copyMessageText, forkTopicAtMessage } from './messageActionHandlers';
import { messageActionStrings } from './messageActionStrings';
import type { MessageActionContext, MessageActionItem } from './types';

export function useBuildActions(
  ctx: MessageActionContext,
): Record<string, MessageActionItem | null> {
  const toggleMessageEditing = useChatStore((s) => s.toggleMessageEditing);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const toggleMessageCollapsed = useChatStore((s) => s.toggleMessageCollapsed);
  const topicStreaming = isTopicStreaming(ctx.topicId);

  return useMemo(() => {
    const { id, message, role, topicId } = ctx;
    const plainText = getMessagePlainText(message);

    const copy: MessageActionItem = {
      handleClick: () => {
        void copyMessageText(plainText);
      },
      icon: Copy,
      key: 'copy',
      label: messageActionStrings.copy,
    };

    const editTargetId = role === 'group' ? ctx.contentBlockId ?? id : id;
    const edit: MessageActionItem | null =
      role === 'assistant' || role === 'user' || role === 'group'
        ? {
            handleClick: () => {
              if (!editTargetId) return;
              if (role === 'assistant' && isAgentConsoleApiMode()) {
                showToast('助手消息暂不支持编辑');
                return;
              }
              toggleMessageEditing(editTargetId, true);
            },
            icon: Edit,
            key: 'edit',
            label: messageActionStrings.edit,
          }
        : null;

    const regenerate: MessageActionItem | null =
      role === 'user' || role === 'assistant' || role === 'group'
        ? {
            disabled: role === 'user' ? !ctx.isLastUser || ctx.isStreaming : ctx.isStreaming,
            handleClick: async () => {
              if (topicStreaming) {
                showToast(messageActionStrings.regenerateWait);
                return;
              }
              if (role === 'user') {
                if (ctx.hasError) deleteMessage(topicId, id);
                await regenerateUserMessage(topicId, id);
                return;
              }
              if (ctx.hasError) deleteMessage(topicId, id);
              await regenerateAssistantMessage(topicId, id);
            },
            icon: RotateCcw,
            key: 'regenerate',
            label: messageActionStrings.regenerate,
          }
        : null;

    const del: MessageActionItem = {
      danger: true,
      handleClick: () => deleteMessage(topicId, id),
      icon: Trash,
      key: 'del',
      label: messageActionStrings.del,
    };

    const delAndRegenerate: MessageActionItem | null =
      role === 'assistant' || role === 'group'
        ? {
            disabled: ctx.isStreaming,
            handleClick: async () => {
              if (topicStreaming) {
                showToast(messageActionStrings.regenerateWait);
                return;
              }
              if (role === 'assistant') {
                await regenerateAssistantMessage(topicId, id);
                return;
              }
              runOrDefer('continueGeneration', () =>
                showToast(messageActionStrings.continueGenerationMock),
              );
            },
            icon: ListRestart,
            key: 'delAndRegenerate',
            label: messageActionStrings.delAndRegenerate,
          }
        : null;

    const forkTopic: MessageActionItem = {
      handleClick: () => forkTopicAtMessage(topicId, id),
      icon: Split,
      key: 'forkTopic',
      label: messageActionStrings.forkTopic,
    };

    const collapse: MessageActionItem | null =
      role === 'assistant' || role === 'group'
        ? {
            handleClick: () => toggleMessageCollapsed(id),
            icon: ctx.isCollapsed ? ListChevronsUpDown : ListChevronsDownUp,
            key: 'collapse',
            label: ctx.isCollapsed ? messageActionStrings.expand : messageActionStrings.collapse,
          }
        : null;

    const continueGeneration: MessageActionItem | null =
      role === 'group'
        ? {
            handleClick: () =>
              runOrDefer('continueGeneration', () =>
                showToast(messageActionStrings.continueGenerationMock),
              ),
            icon: StepForward,
            key: 'continueGeneration',
            label: messageActionStrings.continueGeneration,
          }
        : null;

    const share: MessageActionItem | null =
      role === 'user'
        ? null
        : {
            handleClick: () => {
              void openShareModal(topicId);
            },
            icon: Share2,
            key: 'share',
            label: messageActionStrings.share,
          };

    const translate: MessageActionItem = {
      children: [
        {
          handleClick: () =>
            runOrDefer('messageTranslate', () =>
              showToast(messageActionStrings.translateZh),
            ),
          key: 'zh',
          label: messageActionStrings.translateZh,
        },
        {
          handleClick: () =>
            runOrDefer('messageTranslate', () =>
              showToast(messageActionStrings.translateEn),
            ),
          key: 'en',
          label: messageActionStrings.translateEn,
        },
      ],
      icon: Languages,
      key: 'translate',
      label: messageActionStrings.translate,
    };

    const tts: MessageActionItem = {
      handleClick: () =>
        runOrDefer('messageTts', () => showToast(messageActionStrings.ttsMock)),
      icon: Play,
      key: 'tts',
      label: messageActionStrings.tts,
    };

    return {
      forkTopic,
      collapse,
      continueGeneration,
      copy,
      del,
      delAndRegenerate,
      edit,
      regenerate,
      share,
      translate,
      tts,
    };
  }, [
    ctx,
    deleteMessage,
    topicStreaming,
    toggleMessageCollapsed,
    toggleMessageEditing,
  ]);
}
