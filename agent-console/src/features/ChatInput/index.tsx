import type { IEditor } from '@lobehub/editor';
import { ReactMentionPlugin } from '@lobehub/editor';
import { ChatInput, ChatInputActionBar, Editor } from '@lobehub/editor/react';
import { Flexbox, Skeleton } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { QueueItem } from '../../domain/types';
import type { ChatInputActionKey } from './ActionBar/config';
import {
  selectAllPendingInterventions,
} from '../../selectors/pendingInterventions';
import { selectMessagesForTopic, selectStreamingMessageForTopic } from '../../selectors/storeSelectors';
import { selectTodosForTopic } from '../../selectors/workspaceSelectors';
import {
  CHAT_INPUT_DEFAULT_HEIGHT,
  CHAT_INPUT_DESKTOP_MAX_HEIGHT,
  CHAT_INPUT_MIN_HEIGHT,
} from '../../constants/layoutTokens';
import { usePasteFile, useUploadFiles } from '../../components/DragUploadZone';
import { LayoutContainerContext } from '../../layout/LayoutContainerContext';
import { useAgentConfigStatus } from '../../hooks/data/useAgentConfigStatus';
import { useMainChatInputActions } from '../../hooks/useMainChatInputActions';
import { sendUserMessage } from '../../services/streaming/sendMessage';
import { hasTopicPendingIntervention, PENDING_INTERVENTION_SEND_MESSAGE, syncStaleApprovalContext } from '../../services/streaming/interventionGate';
import { showToast } from '../../services/ui/toast';
import { useActiveTopicStreaming, useActiveTopicMessageQueue, useActiveTopicStreamRuntime } from '../../services/streaming/streamingScope';
import {
  useChatStore,
  useConfigStore,
  useInputStore,
  useLayoutStore,
  useStreamingStore,
  useTopicStore,
  useWorkspaceStore,
} from '../../stores';
import { WideScreenContainer } from '../WideScreenContainer';
import { chatInputStrings } from './chatInputStrings';
import { chatInputStyles } from './chatInputStyles';
import { ContextContainer } from './ContextContainer';
import { ControlBar } from './ControlBar';
import { EditorContextMenu } from './EditorContextMenu';
import { InputActionBar } from './InputActionBar';
import { InputCompletionAlert } from './InputCompletionAlert';
import { InterventionBar } from './InterventionBar';
import { OpStatusTray } from './OpStatusTray';
import { overlayStackStyles } from './overlayStackStyles';
import { QueueTray } from './QueueTray';
import { TodoProgress } from './TodoProgress';
import { SendArea } from './SendArea';
import { TypoBar } from './TypoBar';
import { AgentConfigError } from './AgentConfigError';
import { ReactActionTagPlugin, useSlashActionItems } from './editor/ActionTag';
import { useMentionEditorOption } from './editor/MentionMenu';
import { ReactReferTopicPlugin } from './editor/ReferTopic';
import { readEditorMarkdown, readEditorPlainText } from './editor/editorText';
import { readEditorSendPayload } from './editor/attachmentEditor';
import { useSkillDrop } from './useSkillDrop';
import { executeSlashCommands } from '../../services/commands/executeSlashCommands';
import { parseCommandsFromEditorData } from '../../services/commands/parseCommands';

export interface DesktopChatInputProps {
  leftActions?: ChatInputActionKey[];
  rightActions?: ChatInputActionKey[];
  controlBarSlot?: ReactNode;
  sendButtonDisabled?: boolean;
  sendButtonShape?: 'round' | 'default';
  showAgentConfigError?: boolean;
  showSendMenu?: boolean;
  prependAlerts?: ReactNode;
  /** Reserved for §C.48 scroll margin when guard alerts visible. */
  hasGuard?: boolean;
}

/**
 * §C.4 DesktopChatInput
 * ChatInput footer/header slots · LayoutContainer portal · chatInputHeight 持久化
 */
export const DesktopChatInput = memo(function DesktopChatInput({
  leftActions: leftActionsProp,
  rightActions: rightActionsProp,
  controlBarSlot,
  sendButtonDisabled = false,
  sendButtonShape,
  showAgentConfigError = true,
  showSendMenu,
  prependAlerts,
  hasGuard: _hasGuard = false,
}: DesktopChatInputProps = {}) {
  const layoutContainerRef = useContext(LayoutContainerContext);
  const chatInputHeight = useLayoutStore((s) => s.chatInputHeight);
  const setChatInputHeight = useLayoutStore((s) => s.setChatInputHeight);

  const isStreaming = useActiveTopicStreaming();
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const messageQueue = useActiveTopicMessageQueue();
  const streamRuntime = useActiveTopicStreamRuntime();
  const opTrayVisible = Boolean(streamRuntime?.opTrayVisible) && isStreaming;
  const stop = useCallback(() => {
    if (activeTopicId) useStreamingStore.getState().stop(activeTopicId);
  }, [activeTopicId]);
  const messages = useChatStore(selectMessagesForTopic(activeTopicId));
  const streamingMessage = useChatStore(selectStreamingMessageForTopic(activeTopicId));
  const pendingPermissionId = useStreamingStore((s) => {
    if (!activeTopicId) return undefined;
    const topicCtx = s.pendingApprovalContextByTopicId[activeTopicId];
    const runtimeCtx = s.streamsByTopicId[activeTopicId]?.activeRunContext;
    return topicCtx?.permissionId ?? runtimeCtx?.permissionId;
  });
  const pendingHitlRequestId = useStreamingStore((s) => {
    if (!activeTopicId) return undefined;
    const topicCtx = s.pendingApprovalContextByTopicId[activeTopicId];
    const runtimeCtx = s.streamsByTopicId[activeTopicId]?.activeRunContext;
    return topicCtx?.hitlRequestId ?? runtimeCtx?.hitlRequestId;
  });
  const pendingInterventions = useMemo(
    () =>
      selectAllPendingInterventions(messages, streamingMessage, {
        permissionId: pendingPermissionId,
        hitlRequestId: pendingHitlRequestId,
      }),
    [messages, streamingMessage, pendingPermissionId, pendingHitlRequestId],
  );
  const hasPendingInterventions = pendingInterventions.length > 0;
  const featureSlash = useInputStore((s) => s.featureSlash);
  const slashPlacement = useInputStore((s) => s.slashPlacement);
  const inputExpanded = useInputStore((s) => s.inputExpanded);
  const mainEditor = useInputStore((s) => s.mainEditor);
  const chatUploadFileList = useInputStore((s) => s.chatUploadFileList);
  const setMainEditor = useInputStore((s) => s.setMainEditor);
  const setMarkdownContent = useInputStore((s) => s.setMarkdownContent);
  const setDraft = useInputStore((s) => s.setDraft);
  const setInputExpanded = useInputStore((s) => s.setInputExpanded);
  const { isConfigLoading } = useAgentConfigStatus();
  const useCmdEnterToSend = useConfigStore((s) => s.useCmdEnterToSend);

  const editorRef = useRef<IEditor | null>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const [ctxMenuPos, setCtxMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [hasText, setHasText] = useState(false);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const inputAnchorRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const prependAlertsRef = useRef<HTMLDivElement>(null);

  const { leftActions: defaultLeft, rightActions: defaultRight } = useMainChatInputActions();
  const leftActions = leftActionsProp ?? defaultLeft;
  const rightActions = rightActionsProp ?? defaultRight;

  const slashItems = useSlashActionItems();
  const slashOption = useMemo(
    () => (featureSlash ? { items: slashItems } : undefined),
    [featureSlash, slashItems],
  );
  const { mentionOption } = useMentionEditorOption();

  const { onDragOver, onDrop } = useSkillDrop(editorRef);
  const { handleUploadFiles } = useUploadFiles();

  const handleEditorChange = useCallback(
    (editor: IEditor) => {
      editorRef.current = editor;
      const text = readEditorPlainText(editor);
      setHasText(text.trim().length > 0);
      const markdown = readEditorMarkdown(editor);
      setMarkdownContent(markdown);
      setDraft(text);
    },
    [setDraft, setMarkdownContent],
  );

  const syncEditorFromPaste = useCallback(() => {
    requestAnimationFrame(() => {
      const editor = editorRef.current ?? useInputStore.getState().mainEditor;
      if (!editor) return;
      handleEditorChange(editor);
    });
  }, [handleEditorChange]);

  usePasteFile(mainEditor ?? undefined, handleUploadFiles, syncEditorFromPaste);

  const canSend = hasText || chatUploadFileList.length > 0;

  const hasQueue = messageQueue.length > 0;
  const todoCount = useWorkspaceStore(selectTodosForTopic(activeTopicId)).length;
  const hasTodos = todoCount > 0;
  const hasTray = hasQueue || hasTodos || opTrayVisible;

  useEffect(() => {
    setInputExpanded(false);
    if (!hasPendingInterventions) {
      editorRef.current?.focus();
    }
  }, [activeTopicId, hasPendingInterventions, setInputExpanded]);

  useEffect(() => {
    if (inputExpanded) editorRef.current?.focus();
  }, [inputExpanded]);

  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);

  useLayoutEffect(() => {
    const wrap = inputWrapRef.current;
    const anchor = inputAnchorRef.current;
    const overlay = overlayRef.current;
    const footer = wrap?.closest('[data-region="chat-input"]');
    if (!wrap || !anchor) return;

    const measure = () => {
      const overlayHeight = overlay?.offsetHeight ?? 0;
      const alertsHeight = prependAlertsRef.current?.offsetHeight ?? 0;
      const mobile = useLayoutStore.getState().isMobileViewport;
      // Desktop: absolute trays extend upward into the conversation column.
      const overlap = mobile ? 0 : overlayHeight + alertsHeight;
      useChatStore.getState().setChatInputOverlayHeight(Math.round(overlap));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    observer.observe(anchor);
    if (overlay) observer.observe(overlay);
    const alertsEl = prependAlertsRef.current;
    if (alertsEl) observer.observe(alertsEl);
    if (footer instanceof HTMLElement) observer.observe(footer);
    return () => observer.disconnect();
  }, [hasTray, hasPendingInterventions, inputExpanded, isMobileViewport, prependAlerts]);

  const handleSend = useCallback(() => {
    if (sendButtonDisabled) return;
    syncStaleApprovalContext(activeTopicId);
    if (hasTopicPendingIntervention(activeTopicId)) {
      showToast(PENDING_INTERVENTION_SEND_MESSAGE);
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;

    const editorData = editor.getDocument('json') as Record<string, unknown> | undefined;
    const commands = parseCommandsFromEditorData(editorData);
    if (commands.length > 0) {
      executeSlashCommands(commands, activeTopicId);
      editor.cleanDocument();
      setHasText(false);
      setInputExpanded(false);
      return;
    }

    const attachmentRefs = useInputStore.getState().chatUploadFileList;
    const { message, editorData: sendEditorData } = readEditorSendPayload(editor);
    const hasAttachments = attachmentRefs.length > 0;
    if (!message && !hasAttachments) return;
    void sendUserMessage(activeTopicId, {
      message,
      editorData: sendEditorData,
      attachmentRefs,
    });
    editor.cleanDocument();
    setHasText(false);
    setInputExpanded(false);
  }, [activeTopicId, sendButtonDisabled, setInputExpanded]);

  const fillEditor = useCallback((item: QueueItem | string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = typeof item === 'string' ? item : item.text;
    editor.setDocument('text', text);
    editor.focus();
  }, []);

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      void handleUploadFiles(Array.from(files));
    },
    [handleUploadFiles],
  );

  const handleEditorInit = useCallback(
    (editor: IEditor) => {
      editorRef.current = editor;
      setMainEditor(editor);
      setHasText(readEditorPlainText(editor).trim().length > 0);
    },
    [setMainEditor],
  );

  const handlePressEnter = useCallback(
    ({ event }: { event: KeyboardEvent }) => {
      if (sendButtonDisabled || hasPendingInterventions || !canSend) return false;
      if (inputExpanded && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSend();
        return true;
      }
      if (!inputExpanded && useCmdEnterToSend && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSend();
        return true;
      }
      if (!inputExpanded && !useCmdEnterToSend && !event.shiftKey) {
        event.preventDefault();
        handleSend();
        return true;
      }
      return false;
    },
    [canSend, handleSend, hasPendingInterventions, inputExpanded, sendButtonDisabled, useCmdEnterToSend],
  );

  const loadingLeftSlot = isConfigLoading ? (
    <Flexbox horizontal align="center" gap={6} paddingInline={4}>
      <Skeleton.Button active shape="circle" size="small" style={{ height: 28, width: 28 }} />
      <Skeleton.Button active shape="circle" size="small" style={{ height: 28, width: 28 }} />
    </Flexbox>
  ) : null;

  const loadingRightSlot = isConfigLoading ? (
    <Skeleton.Button active shape="round" size="small" style={{ height: 32, minWidth: 64, width: 64 }} />
  ) : null;

  const inputCore = (
    <Flexbox
      className={cx(
        chatInputStyles.container,
        chatInputStyles.inputRadius,
        inputExpanded && chatInputStyles.fullscreen,
      )}
      gap={8}
      paddingBlock={inputExpanded ? 0 : '0 8px'}
      width="100%"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={cx(
          chatInputStyles.inputCard,
          hasTray && chatInputStyles.inputCardHasTray,
          inputExpanded && chatInputStyles.inputCardExpanded,
        )}
        id="inputCard"
      >
        <ChatInput
          className={cx(inputExpanded && chatInputStyles.inputFullscreen)}
          data-testid="chat-input"
          defaultHeight={chatInputHeight || CHAT_INPUT_DEFAULT_HEIGHT}
          fullscreen={inputExpanded}
          maxHeight={inputExpanded ? undefined : CHAT_INPUT_DESKTOP_MAX_HEIGHT}
          minHeight={CHAT_INPUT_MIN_HEIGHT}
          resize={!inputExpanded}
          showResizeHandle={!inputExpanded}
          slashMenuRef={slashMenuRef}
          header={
            <div className={chatInputStyles.inputCardHeader} id="inputCardHeader">
              <ContextContainer />
              <TypoBar />
            </div>
          }
          footer={
            <ChatInputActionBar
              style={{ paddingRight: 8 }}
              left={
                isConfigLoading ? (
                  loadingLeftSlot
                ) : (
                  <InputActionBar leftActions={leftActions} onFilesSelected={handleFilesSelected} />
                )
              }
              right={
                isConfigLoading ? (
                  loadingRightSlot
                ) : (
                  <SendArea
                    generating={isStreaming}
                    hasContent={canSend}
                    rightActions={rightActions}
                    sendDisabled={sendButtonDisabled || hasPendingInterventions}
                    shape={sendButtonShape}
                    showSendMenu={showSendMenu}
                    onSend={handleSend}
                    onStop={() => stop()}
                  />
                )
              }
            />
          }
          onSizeChange={setChatInputHeight}
        >
          <div
            className={cx(
              chatInputStyles.inputEditorWrap,
              inputExpanded && chatInputStyles.inputEditorWrapExpanded,
            )}
          >
            <div className={chatInputStyles.inputEditorInner}>
              <Editor
                key={activeTopicId}
                type="text"
                variant="chat"
                content=""
                plugins={[ReactActionTagPlugin, ReactMentionPlugin, ReactReferTopicPlugin]}
                slashOption={slashOption}
                slashPlacement={slashPlacement}
                mentionOption={mentionOption}
                placeholder={chatInputStrings.placeholder}
                onInit={handleEditorInit}
                onTextChange={handleEditorChange}
                onPressEnter={handlePressEnter}
              onContextMenu={({ event }) => {
                event.preventDefault();
                setCtxMenuPos({ left: event.clientX, top: event.clientY });
              }}
            />
            </div>
          </div>
        </ChatInput>
      </div>
      {controlBarSlot ?? (
        <ControlBar isConfigLoading={isConfigLoading} rightActions={rightActions} />
      )}
    </Flexbox>
  );

  const renderedInput =
    inputExpanded && layoutContainerRef.current
      ? createPortal(inputCore, layoutContainerRef.current)
      : inputCore;

  return (
    <footer className={chatInputStyles.chatInputArea} data-region="chat-input">
      <WideScreenContainer width="100%">
        {prependAlerts ? <div ref={prependAlertsRef}>{prependAlerts}</div> : null}
        {showAgentConfigError ? <AgentConfigError /> : null}
        <div
          ref={inputWrapRef}
          className={cx(chatInputStyles.inputWrap, inputExpanded && chatInputStyles.inputWrapFullscreen)}
          id="inputWrap"
        >
        {hasPendingInterventions ? (
          <InterventionBar interventions={pendingInterventions} />
        ) : null}
        <EditorContextMenu
          editorRef={editorRef}
          pos={ctxMenuPos}
          onClose={() => setCtxMenuPos(null)}
        />
        <div
          ref={inputAnchorRef}
          className={cx(
            chatInputStyles.inputCardAnchor,
            hasTray && chatInputStyles.inputCardAnchorGrouped,
          )}
        >
          <div ref={overlayRef} className={overlayStackStyles.stack}>
            <QueueTray
              onEditQueued={fillEditor}
              onSendQueued={(item) => void sendUserMessage(activeTopicId, { message: item.text })}
            />
            <TodoProgress topAttached={hasQueue} />
            <OpStatusTray topAttached={hasQueue || hasTodos} />
          </div>
          <InputCompletionAlert />
          {renderedInput}
        </div>
        </div>
      </WideScreenContainer>
    </footer>
  );
});
