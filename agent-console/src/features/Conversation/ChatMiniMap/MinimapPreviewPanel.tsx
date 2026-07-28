import { cx } from 'antd-style';
import { memo } from 'react';

import { minimapStyles } from './minimapStyles';
import type { MinimapItem } from './types';

interface MinimapPreviewPanelProps {
  activeIndex: number;
  hovered: boolean;
  items: MinimapItem[];
  onJump: (item: MinimapItem) => void;
}

export const MinimapPreviewPanel = memo(function MinimapPreviewPanel({
  activeIndex,
  hovered,
  items,
  onJump,
}: MinimapPreviewPanelProps) {
  return (
    <div
      className={cx(minimapStyles.previewPanel, hovered && minimapStyles.previewPanelVisible)}
      id="minimapPreviewPanel"
      aria-hidden={!hovered}
    >
      <div className={minimapStyles.previewList} id="minimapPreviewList">
        {items.map((item) => {
          const isActive = item.position === activeIndex;
          return (
            <button
              key={`preview-${item.message.id}`}
              type="button"
              className={cx(minimapStyles.previewItem, isActive && minimapStyles.previewItemActive)}
              onClick={() => onJump(item)}
            >
              <span
                className={cx(minimapStyles.previewLabel, isActive && minimapStyles.previewLabelActive)}
              >
                {item.preview || '空消息'}
              </span>
              <span
                className={cx(minimapStyles.previewDash, isActive && minimapStyles.previewDashActive)}
                style={{ width: item.width }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
});

/** Standalone preview label (fixtures / demos). */
export const MinimapPreview = memo(function MinimapPreview({ text }: { text: string }) {
  return <div className={minimapStyles.previewLabelStandalone}>{text}</div>;
});
