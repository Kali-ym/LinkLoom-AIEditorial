import { cx } from 'antd-style';
import { memo } from 'react';

import { minimapStyles } from './minimapStyles';
import type { MinimapItem } from './types';

interface MinimapIndicatorProps {
  activeIndex: number;
  hovered: boolean;
  isDense: boolean;
  items: MinimapItem[];
  onJump: (item: MinimapItem) => void;
}

export const MinimapIndicator = memo(function MinimapIndicator({
  activeIndex,
  hovered,
  isDense,
  items,
  onJump,
}: MinimapIndicatorProps) {
  return (
    <div
      className={cx(
        minimapStyles.rail,
        hovered && minimapStyles.railFaded,
        isDense && minimapStyles.railDense,
      )}
      id="minimapRail"
      role="group"
      aria-label="消息索引"
    >
      {items.map((item) => {
        const isActive = item.position === activeIndex;
        return (
          <button
            key={item.message.id}
            type="button"
            className={cx(
              minimapStyles.indicator,
              !isActive && minimapStyles.indicatorHover,
              isActive && minimapStyles.indicatorActive,
            )}
            style={{ width: item.width }}
            aria-label={`跳转到第 ${item.position + 1} 条用户消息`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onJump(item)}
          >
            <span className={minimapStyles.indicatorBar} />
          </button>
        );
      })}
    </div>
  );
});
