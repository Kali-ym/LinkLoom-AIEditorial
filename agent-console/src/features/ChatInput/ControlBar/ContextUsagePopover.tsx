import { Flexbox, Popover } from '@lobehub/ui';
import { TokenTag } from '@lobehub/ui/chat';
import { cssVar } from 'antd-style';
import { memo, type ReactNode } from 'react';

import type { ContextUsageSnapshot } from '../../../domain/types/contextUsage';
import { formatTokens } from './ContextCategoryRow';
import { ContextCategoryList } from './ContextCategoryList';

const SOURCE_LABELS: Record<ContextUsageSnapshot['source'], string> = {
  estimate: '本地估算',
  counter: '精确计数',
  provider: '提供商',
};

export interface ContextUsagePopoverProps {
  snapshot: ContextUsageSnapshot | null;
  trigger?: ReactNode;
  placement?: 'top' | 'topRight' | 'topLeft' | 'bottom' | 'bottomRight' | 'bottomLeft';
}

export const ContextUsagePopover = memo(function ContextUsagePopover({
  snapshot,
  trigger,
  placement = 'topRight',
}: ContextUsagePopoverProps) {
  if (!snapshot) {
    return <>{trigger ?? null}</>;
  }

  const ratio = snapshot.usageRatio;
  const status: 'normal' | 'warning' | 'danger' =
    ratio > 0.9 ? 'danger' : ratio > 0.75 ? 'warning' : 'normal';

  const headerColor =
    status === 'danger'
      ? cssVar.colorError
      : status === 'warning'
        ? cssVar.colorWarning
        : cssVar.colorSuccess;

  const content = (
    <Flexbox gap={12} style={{ minWidth: 320, maxWidth: 360 }}>
      <Flexbox horizontal align="center" gap={6} justify="space-between" width="100%">
        <div style={{ fontSize: 13, color: cssVar.colorText, fontWeight: 500 }}>
          上下文用量
        </div>
        <Flexbox horizontal align="center" gap={6}>
          <span
            style={{
              fontSize: 11,
              color: cssVar.colorTextTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {SOURCE_LABELS[snapshot.source] ?? snapshot.source}
          </span>
          {snapshot.round != null && (
            <span style={{ fontSize: 11, color: cssVar.colorTextTertiary }}>
              · R{snapshot.round}
            </span>
          )}
          {snapshot.compacted && (
            <span
              style={{
                fontSize: 11,
                color: cssVar.colorWarning,
                background: cssVar.colorWarningBg,
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              已压缩
            </span>
          )}
        </Flexbox>
      </Flexbox>
      <ContextCategoryList snapshot={snapshot} />
      <Flexbox
        horizontal
        align="center"
        justify="space-between"
        style={{ fontSize: 11, color: cssVar.colorTextTertiary }}
      >
        <span>
          drift ×{snapshot.driftMultiplier.toFixed(2)} · 调整后 {formatTokens(snapshot.adjustedTotal)}
        </span>
        <span style={{ color: headerColor }}>{Math.round(ratio * 100)}%</span>
      </Flexbox>
    </Flexbox>
  );

  const defaultTrigger = (
    <TokenTag
      maxValue={snapshot.maxContextTokens}
      mode="used"
      value={snapshot.adjustedTotal}
      size={{ blockSize: 28, size: 18 }}
      text={{ overload: '超出', remained: '剩余', used: '已用' }}
    />
  );

  return (
    <Popover
      content={content}
      placement={placement}
      trigger="click"
      styles={{
        content: {
          border: `1px solid ${cssVar.colorBorderSecondary}`,
          padding: 14,
          background: cssVar.colorBgElevated,
          borderRadius: 10,
          boxShadow: cssVar.boxShadowTertiary,
        },
      }}
    >
      <div>{trigger ?? defaultTrigger}</div>
    </Popover>
  );
});
