import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';

import { ContextTokenCategory } from '../../../domain/types/contextUsage';
import type { ContextTokenCategory as ContextTokenCategoryType } from '../../../domain/types/contextUsage';

export interface ContextCategoryRowProps {
  category: ContextTokenCategoryType;
  label: string;
  tokens: number;
  ratio: number;
  color: string;
  highlighted?: boolean;
  onHover?: (category: ContextTokenCategoryType | null) => void;
}

export const CATEGORY_LABELS: Record<ContextTokenCategory, string> = {
  [ContextTokenCategory.SystemPrompt]: '系统提示',
  [ContextTokenCategory.ToolDefinitions]: '工具定义',
  [ContextTokenCategory.Rules]: '规则',
  [ContextTokenCategory.Skills]: '技能',
  [ContextTokenCategory.Mcp]: 'MCP',
  [ContextTokenCategory.SubagentDefinitions]: '子 Agent',
  [ContextTokenCategory.Conversation]: '会话消息',
  [ContextTokenCategory.SummarizedConversation]: '历史摘要',
};

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

export const ContextCategoryRow = memo(function ContextCategoryRow({
  category,
  label,
  tokens,
  ratio,
  color,
  highlighted,
  onHover,
}: ContextCategoryRowProps) {
  const percent = ratio > 0 ? Math.max(ratio * 100, 0.1) : 0;

  return (
    <Flexbox
      horizontal
      align="center"
      gap={8}
      width="100%"
      onMouseEnter={() => onHover?.(category)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        padding: '6px 8px',
        borderRadius: 6,
        background: highlighted ? cssVar.colorFillQuaternary : 'transparent',
        cursor: 'default',
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: 1,
          fontSize: 13,
          color: cssVar.colorText,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          color: cssVar.colorTextSecondary,
        }}
      >
        {formatTokens(tokens)}
      </div>
      <div
        style={{
          fontSize: 12,
          color: cssVar.colorTextTertiary,
          minWidth: 40,
          textAlign: 'right',
        }}
      >
        {percent > 0 ? `${percent.toFixed(0)}%` : ''}
      </div>
    </Flexbox>
  );
});
