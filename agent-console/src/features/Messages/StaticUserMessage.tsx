import { Tag } from '@lobehub/ui';
import { memo, useCallback, useEffect, useMemo, useState, type MouseEventHandler } from 'react';

import type { ChatAttachmentRef } from '../../adapters/ports/IUploadPort';
import type {
  MessageFileItem,
  MessageImageItem,
  MessageVideoItem,
  PageSelection,
} from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import type { StaticUserMessage } from '../../domain/types/conversation';
import { useDoubleClickEdit } from '../../hooks/useDoubleClickEdit';
import { regenerateUserMessage } from '../../services/streaming/sendMessage';
import { useTopicStreaming } from '../../services/streaming/streamingScope';
import { useAgentStore } from '../../stores/agentStore';
import { useChatStore } from '../../stores/chatStore';
import {
  attachmentIdsEqual,
  mapChatAttachmentRefsToFileRefs,
  mapMessageAttachmentsToChatRefs,
} from '../../utils/userTurnAttachments';
import {
  buildPlainText,
  formatUserMessageTime,
  toUserMessageDisplay,
} from '../../utils/userMessageContent';
import { ChatItem } from '../Conversation/ChatItem/ChatItem';
import { useSetMessageItemActionElementPortialContext } from './Contexts/message-action-context';
import { useSetMessageItemActionTypeContext } from './Contexts/message-action-context';
import { EditorModal } from '../EditorModal';
import { UserMessageActionsPortal } from './UserMessageActionsPortal';
import { UserMessageContent } from './UserMessageContent';

export interface UserMessageViewModel {
  id: string;
  time: string;
  content?: string;
  text?: string;
  linkLine?: StaticUserMessage['linkLine'];
  linkCard?: StaticUserMessage['linkCard'];
  targetId?: string;
  isCreating?: boolean;
  pageSelections?: PageSelection[];
  imageList?: MessageImageItem[];
  videoList?: MessageVideoItem[];
  fileList?: MessageFileItem[];
  editorData?: unknown;
}

/** §C.10 User bubble — ChatItem + portal Actions + EditorModal */
export const StaticUserMessageView = memo(function StaticUserMessageView({
  message,
  index,
  topicId,
  isLastUser,
  editable = true,
  onUpdate,
}: {
  message: UserMessageViewModel;
  index: number;
  topicId: string;
  isLastUser: boolean;
  editable?: boolean;
  onUpdate?: (messageId: string, payload: UserTurnPayload) => void | Promise<void>;
}) {
  const editing = useChatStore((s) => s.editingMessageId === message.id);
  const toggleMessageEditing = useChatStore((s) => s.toggleMessageEditing);
  const isInputLoading = useTopicStreaming(topicId);
  const agents = useAgentStore((s) => s.agents);
  const [editAttachments, setEditAttachments] = useState<ChatAttachmentRef[]>([]);
  const initialAttachments = useMemo(
    () => mapMessageAttachmentsToChatRefs(message.imageList, message.fileList),
    [message.fileList, message.imageList],
  );

  useEffect(() => {
    if (editing) {
      setEditAttachments(initialAttachments);
    }
  }, [editing, initialAttachments]);

  const setPortalElement = useSetMessageItemActionElementPortialContext();
  const setActionType = useSetMessageItemActionTypeContext();

  const display = toUserMessageDisplay(message);
  const timeLabel = formatUserMessageTime(message.time);
  const plainText = buildPlainText({
    text: display.text,
    linkLine: display.linkLine,
    content: message.content,
  });

  const dmIndicator = useMemo(() => {
    if (!message.targetId) return undefined;
    const targetName =
      agents.find((agent) => agent.id === message.targetId)?.name ?? message.targetId;
    return <Tag>仅 {targetName} 可见</Tag>;
  }, [agents, message.targetId]);

  const openEdit = useCallback(
    (messageId: string) => {
      if (!editable) return;
      toggleMessageEditing(messageId, true);
    },
    [editable, toggleMessageEditing],
  );

  const onDoubleClick = useDoubleClickEdit({
    disableEditing: !editable,
    id: message.id,
    onEdit: openEdit,
  });

  const onMouseEnter: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (!editable) return;
      setPortalElement(e.currentTarget);
      setActionType({ id: message.id, index, type: 'user' });
    },
    [editable, index, message.id, setActionType, setPortalElement],
  );

  const shouldSendOnConfirm =
    editing &&
    isLastUser &&
    !isInputLoading;

  const handleConfirm = useCallback(
    async (nextText: string, editorData?: unknown) => {
      const trimmed = nextText.trim();
      const files = mapChatAttachmentRefsToFileRefs(editAttachments);
      const hasTextChange = trimmed !== plainText;
      const hasAttachmentChange = !attachmentIdsEqual(editAttachments, initialAttachments);
      const hasEditorChange = editorData !== undefined;

      if (onUpdate && (hasTextChange || hasAttachmentChange || hasEditorChange)) {
        await Promise.resolve(
          onUpdate(message.id, {
            message: trimmed,
            editorData: editorData as Record<string, unknown> | undefined,
            files,
          }),
        );
      }
      toggleMessageEditing(message.id, false);
      if (shouldSendOnConfirm && (trimmed || files.length > 0)) {
        await regenerateUserMessage(topicId, message.id);
      }
    },
    [
      editAttachments,
      initialAttachments,
      message.id,
      onUpdate,
      plainText,
      shouldSendOnConfirm,
      topicId,
      toggleMessageEditing,
    ],
  );

  return (
    <>
      <ChatItem
        actions={
          editable ? (
            <UserMessageActionsPortal />
          ) : undefined
        }
        data-msg-type="user"
        id={message.id}
        placement="right"
        showTitle={false}
        time={timeLabel}
        titleAddon={dmIndicator}
        onDoubleClick={onDoubleClick}
        onMouseEnter={onMouseEnter}
      >
        <UserMessageContent
          fileList={message.fileList}
          imageList={message.imageList}
          message={message}
          pageSelections={message.pageSelections}
          videoList={message.videoList}
        />
      </ChatItem>
      <EditorModal
        attachments={editAttachments}
        editorData={message.editorData}
        okText={shouldSendOnConfirm ? '发送' : '保存'}
        open={editing}
        value={plainText}
        onAttachmentsChange={setEditAttachments}
        onCancel={() => toggleMessageEditing(message.id, false)}
        onConfirm={handleConfirm}
      />
    </>
  );
});

export { createUserMessageFields } from '../../services/messages/createUserMessageFields';
