import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';

import { formatTokens } from './ContextCategoryRow';

export interface ContextTotalBarProps {
  segments: Array<{ category: string; tokens: number; color: string }>;
  totalTokens: number;
  maxTokens: number;
  highlightCategory?: string | null;
}

export const ContextTotalBar = memo(function ContextTotalBar({
  segments,
  totalTokens,
  maxTokens,
  highlightCategory,
}: ContextTotalBarProps) {
  const usedRatio = maxTokens > 0 ? Math.min(totalTokens / maxTokens, 1) : 0;
  const remainingRatio = 1 - usedRatio;

  return (
    <Flexbox width="100%" gap={6}>
      <Flexbox
        horizontal
        height={8}
        width="100%"
        style={{
          background: cssVar.colorFillTertiary,
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {segments.map((seg) => {
          const segRatio = maxTokens > 0 ? seg.tokens / maxTokens : 0;
          if (segRatio <= 0) return null;
          const dim = highlightCategory && highlightCategory !== seg.category ? 0.35 : 1;
          return (
            <div
              key={seg.category}
              style={{
                background: seg.color,
                opacity: dim,
                flex: `${segRatio} 0 0`,
                transition: 'opacity 0.15s',
              }}
            />
          );
        })}
        <div style={{ background: 'transparent', flex: `${remainingRatio} 0 0` }} />
      </Flexbox>
      <Flexbox horizontal align="center" justify="space-between" width="100%">
        <div style={{ fontSize: 12, color: cssVar.colorTextTertiary }}>
          {formatTokens(totalTokens)} / {formatTokens(maxTokens)}
        </div>
        <div style={{ fontSize: 12, color: cssVar.colorTextTertiary }}>
          {Math.round(usedRatio * 100)}%
        </div>
      </Flexbox>
    </Flexbox>
  );
});
