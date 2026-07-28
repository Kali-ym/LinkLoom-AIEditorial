import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';

import {
  DragUploadZone,
  type DroppedFolder,
  useUploadFiles,
} from '../../components/DragUploadZone';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import {
  useAgentStore,
  useChatStore,
  useInputStore,
  useLayoutStore,
  useRouteStore,
  useTopicStore,
  useWorkspaceStore,
} from '../../stores';
import { useMessages } from '../../hooks/data/useMessages';
import { selectMessagesForTopic, selectMinimapVisible, selectStreamingMessageForTopic } from '../../selectors/storeSelectors';
import { systemStatusSelectors } from '../../selectors/systemStatus';
import { IS_ADMIN_DESKTOP } from '../ChatInput/ControlBar/helpers/platform';
import { insertLocalFolderMentions } from '../ChatInput/editor/insertLocalFolderMentions';
import { DesktopChatInput } from '../ChatInput';
import { PortalDrawer } from '../Portal';
import { BackBottom } from './BackBottom';
import { AgentHome } from './AgentHome';
import { ChatHeader } from './Header';
import { ChatList } from './ChatList';
import { ChatMiniMap } from './ChatMiniMap';
import {
  getMinimapActiveIndexFromScroll,
  isChatNearBottom,
  registerChatScrollEl,
  scrollChatToBottom,
  syncPinnedFromScroll,
  followStreamBottom,
  resetScrollState,
  markUserScroll,
  cancelFollowStream,
  suppressAutoFollow,
  snapIfPinned,
} from './chatScroll';
import { ZenModeToast } from '../ZenModeToast';
import { layoutStyles } from '../../styles/layoutStyles';
import { WideScreenContainer } from '../WideScreenContainer';

const dragUploadWrapperStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  width: '100%',
};

export const Conversation = memo(function Conversation() {
  const view = useRouteStore((s) => s.view);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const storeMessages = useChatStore(selectMessagesForTopic(activeTopicId));
  const { data: queryMessages } = useMessages(activeTopicId);
  const messages = useMemo(() => {
    const cached = queryMessages ?? [];
    if (storeMessages.length === 0) return cached;
    if (cached.length === 0) return storeMessages;

    const storeUserCount = storeMessages.filter((message) => message.role === 'user').length;
    const cachedUserCount = cached.filter((message) => message.role === 'user').length;
    if (storeUserCount > cachedUserCount) return storeMessages;
    if (storeMessages.length > cached.length) return storeMessages;

    return cached;
  }, [queryMessages, storeMessages]);
  const streamingMessage = useChatStore(selectStreamingMessageForTopic(activeTopicId));
  const shouldShowMinimap = useChatStore(selectMinimapVisible(activeTopicId));
  const setMinimapActiveIndex = useChatStore((s) => s.setMinimapActiveIndex);
  const setScrollToBottomVisible = useChatStore((s) => s.setScrollToBottomVisible);
  const scrollToBottomVisible = useChatStore((s) => s.scrollToBottomVisible);
  const chatInputOverlayHeight = useChatStore((s) => s.chatInputOverlayHeight);
  const staticConversation = useWorkspaceStore((s) => s.staticConversation);
  const showChatHeader = useLayoutStore(systemStatusSelectors.showChatHeader);
  const isLocalSystemEnabled = useAgentStore((s) => s.isLocalSystemEnabled());
  const { handleUploadFiles } = useUploadFiles();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);
  isStreamingRef.current = Boolean(streamingMessage);

  const enableLocalFolderMention = useMemo(
    () => IS_ADMIN_DESKTOP && isLocalSystemEnabled,
    [isLocalSystemEnabled],
  );

  const handleLocalFolders = useCallback((folders: DroppedFolder[]) => {
    const editor = useInputStore.getState().mainEditor;
    if (!editor) return;
    insertLocalFolderMentions(editor, folders);
  }, []);

  const attachScrollRef = useCallback((node: HTMLDivElement | null) => {
    const typedNode = node as (HTMLDivElement & { __scrollObserver?: ResizeObserver }) | null;
    // Tear down any previous observer (detaching, or re-attaching to a new node).
    typedNode?.__scrollObserver?.disconnect();
    if (typedNode) typedNode.__scrollObserver = undefined;
    scrollRef.current = node;
    registerChatScrollEl(node);
    // Observe the scrollable content's height so that async height changes
    // (images loading, code blocks highlighting, lazy workflows expanding)
    // keep the viewport pinned to the bottom when the user is already there.
    // Without this, the viewport drifts up as content grows underneath it.
    if (node && typeof ResizeObserver !== 'undefined') {
      const target = node.firstElementChild instanceof HTMLElement ? node.firstElementChild : node;
      const observer = new ResizeObserver(() => {
        // Only follow incremental height growth during active streaming.
        // After topic switch / API refresh, useLayoutEffect handles the snap;
        // letting ResizeObserver fire here causes the visible "scroll from top
        // to bottom" as markdown/images hydrate.
        if (isStreamingRef.current) {
          followStreamBottom();
        }
      });
      observer.observe(target);
      (node as HTMLDivElement & { __scrollObserver?: ResizeObserver }).__scrollObserver = observer;
    }
  }, []);

  const syncScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncPinnedFromScroll();
    setScrollToBottomVisible(!isChatNearBottom());
    const userEls = el.querySelectorAll('[data-msg-type="user"]');
    if (userEls.length > 0) {
      setMinimapActiveIndex(getMinimapActiveIndexFromScroll(userEls));
    }
  }, [setMinimapActiveIndex, setScrollToBottomVisible]);

  const onScroll = useCallback(() => {
    markUserScroll();
    syncScrollState();
  }, [syncScrollState]);

  const prevTopicIdRef = useRef(activeTopicId);

  // Topic switch OR bulk message list replace (finalize, API refresh):
  // snap instantly before the browser paints so the user never sees scroll
  // animate from top → bottom. Runs on activeTopicId / messages reference
  // changes — NOT on streaming token deltas (those only touch streamingMessage).
  useLayoutEffect(() => {
    if (view === 'home') return;

    const topicChanged = prevTopicIdRef.current !== activeTopicId;
    prevTopicIdRef.current = activeTopicId;

    if (topicChanged) {
      resetScrollState(true);
    } else {
      // Message list replaced in-place (stream finalize → refresh, hydration).
      suppressAutoFollow(400);
      snapIfPinned();
    }
    syncScrollState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopicId, messages, view]);

  // Streaming token deltas: coalesced RAF follow, only when pinned.
  useEffect(() => {
    if (!streamingMessage || view === 'home') return;
    followStreamBottom();
    syncScrollState();
  }, [streamingMessage, syncScrollState, view]);

  useEffect(() => {
    return () => {
      cancelFollowStream();
    };
  }, []);

  const showHome = view === 'home';

  useEffect(() => {
    if (showHome) {
      setScrollToBottomVisible(false);
    }
  }, [showHome, setScrollToBottomVisible]);

  return (
    <section
      className={`conversation-column ${layoutStyles.conversationColumn}`}
      data-region="conversation"
    >
      {showChatHeader && <ChatHeader />}
      <DragUploadZone
        enableLocalFolderMention={enableLocalFolderMention}
        style={dragUploadWrapperStyle}
        onLocalFolders={enableLocalFolderMention ? handleLocalFolders : undefined}
        onUploadFiles={handleUploadFiles}
      >
        <div className={`conversation-body ${layoutStyles.conversationBody}`} id="conversationBody">
          <div
            ref={attachScrollRef}
            className={`chat-scroll ${layoutStyles.chatScroll}`}
            id="chatScroll"
            onScroll={onScroll}
          >
            <WideScreenContainer flex={1} width="100%">
              <div
                className={`chat-inner ${layoutStyles.chatInner}`}
                style={
                  chatInputOverlayHeight > 0
                    ? { paddingBottom: 16 + chatInputOverlayHeight }
                    : undefined
                }
              >
                <AgentHome visible={showHome} />
                <ChatList
                  hidden={showHome}
                  messages={messages}
                  staticConversation={
                    !isAgentConsoleApiMode() && activeTopicId === 'skills' ? staticConversation : null
                  }
                  streamingMessage={streamingMessage}
                  topicId={activeTopicId}
                />
              </div>
            </WideScreenContainer>
          </div>
          <ChatMiniMap
            hidden={showHome || !shouldShowMinimap}
            messages={messages}
            scrollRootRef={scrollRef}
            onJump={(userPosition) => {
              setMinimapActiveIndex(userPosition);
              syncScrollState();
            }}
          />
          <BackBottom
            bottomOffset={chatInputOverlayHeight}
            visible={scrollToBottomVisible && view !== 'home'}
            onScrollToBottom={() => scrollChatToBottom(true)}
          />
        </div>
        <DesktopChatInput />
      </DragUploadZone>
      <ZenModeToast />
    </section>
  );
});

export const ChatWorkspace = memo(function ChatWorkspace() {
  return (
    <div className={`chat-workspace ${layoutStyles.chatWorkspaceInner}`} data-region="chat-workspace">
      <Conversation />
      <PortalDrawer />
    </div>
  );
});
