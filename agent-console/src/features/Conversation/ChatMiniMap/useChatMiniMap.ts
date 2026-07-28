import { useCallback, useEffect, useRef, useState } from 'react';

import { MINIMAP_CLOSE_DELAY_MS } from '../../../constants/motionTokens';
import { useChatStore } from '../../../stores';
import type { MockMessage } from '../../../stores/types';
import {
  getMinimapIndicatorWidth,
  getMinimapPreviewFromBubble,
  jumpToUserMessageEl,
} from '../chatScroll';
import { DENSE_THRESHOLD, MIN_MESSAGES_THRESHOLD, type MinimapItem } from './types';

function buildMinimapItems(messages: MockMessage[], userEls: Element[]): MinimapItem[] {
  const userMessages = messages.filter((m) => m.role === 'user');
  return userMessages.map((message, position) => {
    const el = userEls[position] ?? null;
    const previewFromDom = el ? getMinimapPreviewFromBubble(el) : '';
    const previewFromStore = message.content.replace(/\s+/g, ' ').trim().slice(0, 100);
    const preview = previewFromDom || previewFromStore;
    return {
      message,
      preview,
      width: getMinimapIndicatorWidth(preview),
      position,
      el,
    };
  });
}

export function useChatMiniMap({
  messages,
  scrollRootRef,
  onJump,
  hidden = false,
}: {
  messages: MockMessage[];
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  onJump: (userPosition: number) => void;
  hidden?: boolean;
}) {
  const activeIndex = useChatStore((s) => s.minimapActiveIndex);
  const [hovered, setHovered] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const root = scrollRootRef.current;
  const userEls = root ? Array.from(root.querySelectorAll('[data-msg-type="user"]')) : [];
  const items = buildMinimapItems(messages, userEls);
  const isDense = items.length > DENSE_THRESHOLD;
  const isCollapsed = hidden || items.length <= MIN_MESSAGES_THRESHOLD;

  const openPreview = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHovered(true);
  }, []);

  const closePreview = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setHovered(false), MINIMAP_CLOSE_DELAY_MS);
  }, []);

  const handleJump = useCallback(
    (item: MinimapItem) => {
      if (item.el) {
        jumpToUserMessageEl(item.el);
      }
      onJump(item.position);
    },
    [onJump],
  );

  const handlePreviewJump = useCallback(
    (item: MinimapItem) => {
      handleJump(item);
      setHovered(false);
    },
    [handleJump],
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return {
    activeIndex,
    closePreview,
    handleJump,
    handlePreviewJump,
    hovered,
    isCollapsed,
    isDense,
    items,
    openPreview,
    shouldUnmount: hidden && items.length <= MIN_MESSAGES_THRESHOLD,
  };
}
