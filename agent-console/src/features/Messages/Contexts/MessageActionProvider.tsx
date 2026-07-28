import { type FC, type PropsWithChildren, memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { MESSAGE_ACTION_BAR_PORTAL_SELECTORS } from '../../../constants/messageActionPortal';
import { AssistantMessageActionsBar } from '../Actions/AssistantActionsBar';
import { UserMessageActionsBar } from '../Actions/UserActionsBar';
import {
  MessageItemActionElementPortialContext,
  MessageItemActionTypeContext,
  type MessageActionType,
  SetMessageItemActionElementPortialContext,
  SetMessageItemActionTypeContext,
  useMessageItemActionElementPortialContext,
  useMessageItemActionTypeContext,
} from './message-action-context';

const UserActionsRenderer = memo(function UserActionsRenderer({
  id,
  index,
  topicId,
  isLastUser,
}: {
  id: string;
  index: number;
  topicId: string;
  isLastUser: boolean;
}) {
  return (
    <UserMessageActionsBar id={id} index={index} isLastUser={isLastUser} topicId={topicId} />
  );
});

const AssistantActionsRenderer = memo(function AssistantActionsRenderer({
  id,
  topicId,
}: {
  id: string;
  topicId: string;
}) {
  return <AssistantMessageActionsBar id={id} topicId={topicId} />;
});

const SingletonMessageActionsBar = memo(function SingletonMessageActionsBar({
  topicId,
  lastUserMessageId,
}: {
  topicId: string;
  lastUserMessageId: string | null;
}) {
  const livePortalElement = useMessageItemActionElementPortialContext();
  const liveActionType = useMessageItemActionTypeContext();

  const hostRef = useRef<HTMLDivElement | null>(null);
  if (!hostRef.current && typeof document !== 'undefined') {
    hostRef.current = document.createElement('div');
    hostRef.current.dataset.singletonMessageActionBarHost = 'true';
  }

  const [popupCloseTick, setPopupCloseTick] = useState(0);
  const popupOpenRef = useRef(false);
  const [committedPortalElement, setCommittedPortalElement] = useState<HTMLDivElement | null>(null);
  const [committedActionType, setCommittedActionType] = useState<MessageActionType | null>(null);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;

    const observer = new MutationObserver(() => {
      const hasOpenPopup = Boolean(hostEl.querySelector('[data-popup-open]'));
      if (hasOpenPopup === popupOpenRef.current) return;
      popupOpenRef.current = hasOpenPopup;
      if (!hasOpenPopup) {
        setPopupCloseTick((t) => t + 1);
      }
    });
    observer.observe(hostEl, {
      attributeFilter: ['data-popup-open'],
      attributes: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;
    if (hostEl.querySelector('[data-popup-open]')) return;
    setCommittedPortalElement((prev) => (prev === livePortalElement ? prev : livePortalElement));
    setCommittedActionType((prev) => {
      if (
        prev?.id === liveActionType?.id &&
        prev?.index === liveActionType?.index &&
        prev?.type === liveActionType?.type
      ) {
        return prev;
      }
      return liveActionType;
    });
  }, [
    livePortalElement,
    liveActionType?.id,
    liveActionType?.index,
    liveActionType?.type,
    popupCloseTick,
  ]);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl || typeof document === 'undefined') return;

    let placeholderEl: HTMLDivElement | null = null;

    if (committedPortalElement && committedActionType) {
      switch (committedActionType.type) {
        case 'user':
          placeholderEl = committedPortalElement.querySelector<HTMLDivElement>(
            MESSAGE_ACTION_BAR_PORTAL_SELECTORS.user,
          );
          break;
        case 'assistant':
          placeholderEl = committedPortalElement.querySelector<HTMLDivElement>(
            MESSAGE_ACTION_BAR_PORTAL_SELECTORS.assistant,
          );
          break;
        case 'assistantGroup':
          placeholderEl = committedPortalElement.querySelector<HTMLDivElement>(
            MESSAGE_ACTION_BAR_PORTAL_SELECTORS.assistantGroup,
          );
          break;
      }
    }

    if (placeholderEl) {
      if (hostEl.parentElement !== placeholderEl) placeholderEl.append(hostEl);
      hostEl.style.display = '';
      return;
    }

    if (document.body && hostEl.parentElement !== document.body) document.body.append(hostEl);
    hostEl.style.display = 'none';
  }, [committedPortalElement, committedActionType?.id, committedActionType?.type]);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;
    return () => hostEl.remove();
  }, []);

  const hostEl = hostRef.current;
  if (!hostEl || !committedActionType) return null;

  if (committedActionType.type === 'user') {
    return createPortal(
      <UserActionsRenderer
        id={committedActionType.id}
        index={committedActionType.index}
        isLastUser={committedActionType.id === lastUserMessageId}
        topicId={topicId}
      />,
      hostEl,
    );
  }

  if (committedActionType.type === 'assistant' || committedActionType.type === 'assistantGroup') {
    return createPortal(
      <AssistantActionsRenderer id={committedActionType.id} topicId={topicId} />,
      hostEl,
    );
  }

  return null;
});

interface MessageActionProviderProps extends PropsWithChildren {
  topicId: string;
  lastUserMessageId: string | null;
  withSingletonActionsBar?: boolean;
}

/** §C.10*/
export const MessageActionProvider: FC<MessageActionProviderProps> = ({
  children,
  topicId,
  lastUserMessageId,
  withSingletonActionsBar = true,
}) => {
  const [messageItemActionElementPortialContext, setMessageItemActionElementPortialContext] =
    useState<HTMLDivElement | null>(null);
  const [messageItemActionTypeContext, setMessageItemActionTypeContext] =
    useState<MessageActionType | null>(null);

  return (
    <MessageItemActionElementPortialContext value={messageItemActionElementPortialContext}>
      <SetMessageItemActionElementPortialContext value={setMessageItemActionElementPortialContext}>
        <SetMessageItemActionTypeContext value={setMessageItemActionTypeContext}>
          <MessageItemActionTypeContext value={messageItemActionTypeContext}>
            {withSingletonActionsBar && (
              <SingletonMessageActionsBar
                lastUserMessageId={lastUserMessageId}
                topicId={topicId}
              />
            )}
            {children}
          </MessageItemActionTypeContext>
        </SetMessageItemActionTypeContext>
      </SetMessageItemActionElementPortialContext>
    </MessageItemActionElementPortialContext>
  );
};
