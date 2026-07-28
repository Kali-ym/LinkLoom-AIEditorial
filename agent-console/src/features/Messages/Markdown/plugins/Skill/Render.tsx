import { memo } from 'react';

import { ActionMention } from '../../../../shared/editor';
import type { MarkdownElementProps } from '../type';

interface SkillNodeProps {
  label?: string;
  name?: string;
}

/** Render persisted `<skill name="…" label="…" />` tags as inline chips. */
export const SkillRender = memo(function SkillRender({
  node,
  children,
}: MarkdownElementProps<SkillNodeProps>) {
  const { label, name } = node?.properties || {};
  const displayLabel =
    (typeof label === 'string' ? label : undefined) ||
    (typeof name === 'string' ? name : undefined) ||
    (typeof children === 'string' ? children : undefined);
  if (!displayLabel) return null;
  return <ActionMention category="skill" label={displayLabel} />;
});
