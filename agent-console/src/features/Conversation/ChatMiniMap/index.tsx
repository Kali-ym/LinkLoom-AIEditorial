import { cx } from 'antd-style';
import { memo } from 'react';

import type { MockMessage } from '../../../stores/types';
import { MinimapIndicator } from './MinimapIndicator';
import { MinimapPreviewPanel } from './MinimapPreviewPanel';
import { minimapStyles } from './minimapStyles';
import { useChatMiniMap } from './useChatMiniMap';

export { MinimapPreview } from './MinimapPreviewPanel';

/** index.html `#chatMinimap` — 原生 DOM + 滚动同步高亮 */
export const ChatMiniMap = memo(function ChatMiniMap({
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
  const {
    activeIndex,
    closePreview,
    handleJump,
    handlePreviewJump,
    hovered,
    isCollapsed,
    isDense,
    items,
    openPreview,
    shouldUnmount,
  } = useChatMiniMap({ messages, scrollRootRef, onJump, hidden });

  if (shouldUnmount) return null;

  return (
    <div
      className={cx(minimapStyles.root, isCollapsed && minimapStyles.rootHidden)}
      id="chatMinimap"
      aria-label="历史消息快速定位"
    >
      <div
        className={minimapStyles.hoverArea}
        id="minimapHoverArea"
        onMouseEnter={openPreview}
        onMouseLeave={closePreview}
      >
        <MinimapIndicator
          activeIndex={activeIndex}
          hovered={hovered}
          isDense={isDense}
          items={items}
          onJump={handleJump}
        />
        <MinimapPreviewPanel
          activeIndex={activeIndex}
          hovered={hovered}
          items={items}
          onJump={handlePreviewJump}
        />
      </div>
    </div>
  );
});
