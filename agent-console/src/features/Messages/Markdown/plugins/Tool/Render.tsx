import { memo } from 'react';

import { ActionMention } from '../../../../shared/editor';
import type { MarkdownElementProps } from '../type';

interface ToolNodeProps {
  label?: string;
  name?: string;
}

/** Render persisted `<tool name="…" label="…" />` tags as inline chips. */
export const ToolRender = memo(function ToolRender({
  node,
  children,
}: MarkdownElementProps<ToolNodeProps>) {
  const { label, name } = node?.properties || {};
  const displayLabel =
    (typeof label === 'string' ? label : undefined) ||
    (typeof name === 'string' ? name : undefined) ||
    (typeof children === 'string' ? children : undefined);
  if (!displayLabel) return null;
  return <ActionMention category="tool" label={displayLabel} />;
});
