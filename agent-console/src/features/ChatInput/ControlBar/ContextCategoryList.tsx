import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useState } from 'react';

import { ContextTokenCategory } from '../../../domain/types/contextUsage';
import type { ContextUsageSnapshot } from '../../../domain/types/contextUsage';
import {
  CATEGORY_LABELS,
  ContextCategoryRow,
  formatTokens,
} from './ContextCategoryRow';
import { ContextTotalBar } from './ContextTotalBar';

export interface CategoryColorMap {
  [key: string]: string;
}

function resolveDefaultCategoryColors(): CategoryColorMap {
  return {
    [ContextTokenCategory.SystemPrompt]: cssVar.magenta,
    [ContextTokenCategory.ToolDefinitions]: cssVar.geekblue,
    [ContextTokenCategory.Rules]: cssVar.orange,
    [ContextTokenCategory.Skills]: cssVar.purple,
    [ContextTokenCategory.Mcp]: cssVar.cyan,
    [ContextTokenCategory.SubagentDefinitions]: cssVar.volcano,
    [ContextTokenCategory.Conversation]: cssVar.gold,
    [ContextTokenCategory.SummarizedConversation]: cssVar.green,
  };
}

export const DEFAULT_CATEGORY_COLORS: CategoryColorMap = resolveDefaultCategoryColors();

const ORDERED_CATEGORIES: ContextTokenCategory[] = [
  ContextTokenCategory.SystemPrompt,
  ContextTokenCategory.ToolDefinitions,
  ContextTokenCategory.Rules,
  ContextTokenCategory.Skills,
  ContextTokenCategory.Mcp,
  ContextTokenCategory.SubagentDefinitions,
  ContextTokenCategory.Conversation,
  ContextTokenCategory.SummarizedConversation,
];

export interface ContextCategoryListProps {
  snapshot: ContextUsageSnapshot;
  colors?: CategoryColorMap;
}

export const ContextCategoryList = memo(function ContextCategoryList({
  snapshot,
  colors = DEFAULT_CATEGORY_COLORS,
}: ContextCategoryListProps) {
  const [hovered, setHovered] = useState<ContextTokenCategory | null>(null);
  const total = snapshot.totalTokens || 1;
  const usable = Math.max(
    snapshot.maxContextTokens - snapshot.reserveOutputTokens - snapshot.compactionBuffer,
    1
  );

  const segments = ORDERED_CATEGORIES.map((cat) => ({
    category: cat,
    tokens: snapshot.byCategory[cat] ?? 0,
    color: colors[cat] ?? cssVar.colorPrimary,
  })).filter((s) => s.tokens > 0);

  return (
    <Flexbox width="100%" gap={10}>
      <ContextTotalBar
        segments={segments}
        totalTokens={snapshot.totalTokens}
        maxTokens={snapshot.maxContextTokens}
        highlightCategory={hovered}
      />
      <Flexbox gap={2}>
        {ORDERED_CATEGORIES.map((cat) => (
          <ContextCategoryRow
            key={cat}
            category={cat}
            label={CATEGORY_LABELS[cat]}
            tokens={snapshot.byCategory[cat] ?? 0}
            ratio={(snapshot.byCategory[cat] ?? 0) / total}
            color={colors[cat] ?? cssVar.colorPrimary}
            highlighted={hovered === cat}
            onHover={setHovered}
          />
        ))}
      </Flexbox>
      <Flexbox
        horizontal
        align="center"
        gap={8}
        justify="space-between"
        style={{
          borderTop: `1px solid ${cssVar.colorBorderSecondary}`,
          marginTop: 4,
          paddingTop: 8,
        }}
      >
        <Flexbox horizontal align="center" gap={8}>
          <div style={{ fontSize: 12, color: cssVar.colorTextSecondary }}>合计</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {formatTokens(snapshot.totalTokens)}
          </div>
        </Flexbox>
        <Flexbox horizontal align="center" gap={8}>
          <div style={{ fontSize: 12, color: cssVar.colorTextSecondary }}>可用</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{formatTokens(usable)}</div>
        </Flexbox>
        <Flexbox horizontal align="center" gap={8}>
          <div style={{ fontSize: 12, color: cssVar.colorTextSecondary }}>剩余</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color:
                snapshot.usageRatio > 0.9
                  ? cssVar.colorError
                  : snapshot.usageRatio > 0.75
                    ? cssVar.colorWarning
                    : cssVar.colorSuccess,
            }}
          >
            {formatTokens(snapshot.remainingTokens)}
          </div>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});
