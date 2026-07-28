import { lazy, memo, Suspense, useCallback, useMemo, type RefObject } from 'react';
import { Virtualizer } from 'virtua';

import type { StaticConversation, StaticUserMessage } from '../../domain/types/conversation';
import type { Message } from '../../domain/types';
import type { UserTurnPayload } from '../../domain/types/userTurn';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import { editUserMessage } from '../../services/messages/editUserMessage';
import type { UserMessageViewModel } from '../Messages/StaticUserMessage';
import type { StreamingMessage } from '../../stores/types';
import { StaticAssistantMessageView } from '../Messages/StaticAssistantMessage';
import { SimpleAssistantMessageView } from '../Messages/SimpleAssistantMessage';
import { MessageItem } from '../Messages/MessageItem';
import { StreamingAssistantMessage } from '../Messages/StreamingAssistantMessage';
import { StaticUserMessageView } from '../Messages/StaticUserMessage';
import { MessageActionProvider } from '../Messages/Contexts/MessageActionProvider';
import { MessageContextMenu, type MessageContextMenuProps } from '../Overlays/MessageContextMenu';

const VIRTUALIZE_AFTER = 40;
const DevShowcaseSection =
  import.meta.env.DEV && !isAgentConsoleApiMode()
    ? lazy(() => import('./ShowcaseSection').then((m) => ({ default: m.ShowcaseSection })))
    : null;

function toUserViewModel(message: Message): UserMessageViewModel {
  return {
    id: message.id,
    time: message.createdAt,
    content: message.content,
    text: message.text,
    linkLine: message.linkLine,
    linkCard: message.linkCard,
    targetId: message.targetId,
    isCreating: message.isCreating,
    pageSelections: message.pageSelections,
    imageList: message.imageList,
    videoList: message.videoList,
    fileList: message.fileList,
    editorData: message.editorData,
  };
}

export const UserMessage = memo(function UserMessage({
  message,
  index,
  topicId,
  isLastUser,
}: {
  message: Message;
  index: number;
  topicId: string;
  isLastUser: boolean;
}) {
  const onUpdate = useCallback(
    (messageId: string, payload: UserTurnPayload) => editUserMessage(topicId, messageId, payload),
    [topicId],
  );

  return (
    <MessageContextMenu message={message} topicId={topicId}>
      <StaticUserMessageView
        index={index}
        isLastUser={isLastUser}
        message={toUserViewModel(message)}
        topicId={topicId}
        onUpdate={onUpdate}
      />
    </MessageContextMenu>
  );
});

function mergeUserView(
  fixture: Pick<StaticUserMessage, 'id' | 'time' | 'linkLine' | 'linkCard'> & { text?: string },
  messages: Message[],
): UserMessageViewModel {
  const fromStore = messages.find((m) => m.id === fixture.id && m.role === 'user');
  if (!fromStore) {
    return {
      id: fixture.id,
      time: fixture.time,
      text: fixture.text,
      linkLine: fixture.linkLine,
      linkCard: fixture.linkCard,
    };
  }
  return toUserViewModel(fromStore);
}

function userViewToContextMessage(view: UserMessageViewModel): NonNullable<MessageContextMenuProps['message']> {
  return {
    id: view.id,
    role: 'user',
    content: view.content ?? view.text ?? '',
    text: view.text,
    linkLine: view.linkLine,
    linkCard: view.linkCard,
  };
}

function staticAssistantPlainText(assistant: {
  content?: string;
  markdown?: StaticConversation['assistant']['markdown'];
}): string {
  if (assistant.content?.trim()) return assistant.content.trim();
  if (!assistant.markdown) return '';
  const { title, intro, bullets, footer } = assistant.markdown;
  const bulletLines = bullets.map((item) => `${item.term}: ${item.detail}`);
  return [title, intro, ...bulletLines, footer].filter(Boolean).join('\n\n');
}

function StaticSkillsConversation({
  staticConversation,
  messages,
  topicId,
  onUpdateStatic,
}: {
  staticConversation: StaticConversation;
  messages: Message[];
  topicId: string;
  onUpdateStatic: (messageId: string, payload: UserTurnPayload) => void;
}) {
  const userIds = [
    ...staticConversation.prelude.map((p) => p.user.id),
    staticConversation.user.id,
    staticConversation.followUpUser.id,
  ];
  const lastUserId = userIds[userIds.length - 1];

  let userIndex = 0;

  return (
    <>
      {staticConversation.prelude.map((pair) => {
        const idx = userIndex++;
        return (
          <span key={pair.user.id} style={{ display: 'contents' }}>
            <MessageContextMenu
              message={userViewToContextMessage(mergeUserView(pair.user, messages))}
              topicId={topicId}
            >
              <StaticUserMessageView
                index={idx}
                isLastUser={pair.user.id === lastUserId}
                message={mergeUserView(pair.user, messages)}
                topicId={topicId}
                onUpdate={(id, payload) => onUpdateStatic(id, payload)}
              />
            </MessageContextMenu>
            <MessageContextMenu
              message={{
                id: `${pair.user.id}-assistant`,
                role: 'assistant',
                content: pair.assistant.content,
              }}
              topicId={topicId}
            >
              <SimpleAssistantMessageView
                time={pair.assistant.time}
                content={pair.assistant.content}
                codeBlock={'codeBlock' in pair.assistant && pair.assistant.codeBlock}
              />
            </MessageContextMenu>
          </span>
        );
      })}
      <MessageContextMenu
        message={userViewToContextMessage(mergeUserView(staticConversation.user, messages))}
        topicId={topicId}
      >
        <StaticUserMessageView
          index={userIndex++}
          isLastUser={staticConversation.user.id === lastUserId}
          message={mergeUserView(staticConversation.user, messages)}
          topicId={topicId}
          onUpdate={(id, payload) => onUpdateStatic(id, payload)}
        />
      </MessageContextMenu>
      <MessageContextMenu
        message={{
          id: staticConversation.assistant.id,
          role: 'assistant',
          content: staticAssistantPlainText(staticConversation.assistant),
        }}
        topicId={topicId}
      >
        <StaticAssistantMessageView message={staticConversation.assistant} />
      </MessageContextMenu>
      <MessageContextMenu
        message={userViewToContextMessage(mergeUserView(staticConversation.followUpUser, messages))}
        topicId={topicId}
      >
        <StaticUserMessageView
          index={userIndex}
          isLastUser={staticConversation.followUpUser.id === lastUserId}
          message={mergeUserView(staticConversation.followUpUser, messages)}
          topicId={topicId}
          onUpdate={(id, payload) => onUpdateStatic(id, payload)}
        />
      </MessageContextMenu>
      <MessageContextMenu
        message={{
          id: `${staticConversation.followUpUser.id}-assistant`,
          role: 'assistant',
          content: staticConversation.followUpAssistant.content,
        }}
        topicId={topicId}
      >
        <SimpleAssistantMessageView
          time={staticConversation.followUpAssistant.time}
          content={staticConversation.followUpAssistant.content}
        />
      </MessageContextMenu>
    </>
  );
}

export const ChatList = memo(function ChatList({
  messages,
  staticConversation,
  streamingMessage,
  topicId,
  hidden = false,
  scrollRootRef,
}: {
  messages: Message[];
  staticConversation?: StaticConversation | null;
  streamingMessage?: StreamingMessage | null;
  topicId: string;
  hidden?: boolean;
  scrollRootRef?: RefObject<HTMLDivElement | null>;
}) {
  const onUpdateStatic = useCallback(
    (messageId: string, payload: UserTurnPayload) => editUserMessage(topicId, messageId, payload),
    [topicId],
  );

  const useStaticThread =
    staticConversation && topicId === 'skills' && messages.length <= 8;

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') return messages[i].id;
    }
    return null;
  }, [messages]);

  const prepared = useMemo(() => {
    let userIndex = 0;
    return messages.map((msg, listIndex) => {
      if (msg.role === 'user') {
        const index = userIndex;
        userIndex += 1;
        return {
          msg,
          listIndex,
          userIndex: index,
          isLastUser: msg.id === lastUserMessageId,
        };
      }
      return { msg, listIndex, userIndex: 0, isLastUser: false };
    });
  }, [lastUserMessageId, messages]);

  const renderItem = (item: (typeof prepared)[number]) =>
    item.msg.role === 'user' ? (
      <UserMessage
        key={item.msg.id}
        index={item.userIndex}
        isLastUser={item.isLastUser}
        message={item.msg}
        topicId={topicId}
      />
    ) : (
      <MessageItem
        key={item.msg.id}
        index={item.listIndex}
        isLastUser={false}
        message={item.msg}
        topicId={topicId}
      />
    );

  const shouldVirtualize = !useStaticThread && prepared.length > VIRTUALIZE_AFTER && scrollRootRef;

  const listBody = useStaticThread ? (
    <StaticSkillsConversation
      messages={messages}
      staticConversation={staticConversation}
      topicId={topicId}
      onUpdateStatic={onUpdateStatic}
    />
  ) : shouldVirtualize ? (
    <Virtualizer scrollRef={scrollRootRef}>
      {prepared.map(renderItem)}
    </Virtualizer>
  ) : (
    prepared.map(renderItem)
  );

  return (
    <div className={`messages${hidden ? ' hidden' : ''}`} id="messages">
      {DevShowcaseSection ? (
        <Suspense fallback={null}>
          <DevShowcaseSection />
        </Suspense>
      ) : null}
      <MessageActionProvider lastUserMessageId={lastUserMessageId} topicId={topicId}>
        {listBody}
      </MessageActionProvider>
      {streamingMessage && (
        <StreamingAssistantMessage
          message={streamingMessage}
          topicId={topicId}
        />
      )}
    </div>
  );
});
