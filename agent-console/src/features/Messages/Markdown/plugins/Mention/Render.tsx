import { createStaticStyles } from 'antd-style';
import { Bot } from 'lucide-react';
import { memo } from 'react';

import { useAgentStore } from '../../../../../stores/agentStore';
import type { MarkdownElementProps } from '../type';

const styles = createStaticStyles(({ css, cssVar }) => ({
  mention: css`
    cursor: default;
    user-select: none;

    display: inline-flex;
    gap: 4px;
    align-items: center;

    margin-inline: 0.25em;
    padding-block: 0.15em;
    padding-inline: 0.4em;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 0.875em;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorInfo};
    vertical-align: -0.1em;

    background: ${cssVar.colorInfoBg};
  `,
  icon: css`
    display: inline-grid;
    place-items: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  `,
}));

interface MentionNodeProps {
  id?: string;
  name?: string;
}

/** Render persisted `<mention name="…" id="…" />` (@agent) as inline chip. */
export const MentionRender = memo(function MentionRender({
  node,
  children,
}: MarkdownElementProps<MentionNodeProps>) {
  const mentionId = node?.properties?.id;
  const fallbackName =
    (typeof node?.properties?.name === 'string' ? node.properties.name : undefined) ||
    (typeof children === 'string' ? children : undefined);
  const agentName = useAgentStore((s) => {
    if (!mentionId) return undefined;
    return s.agents.find((agent) => agent.id === mentionId)?.name;
  });
  const label = agentName || fallbackName;
  if (!label) return null;

  return (
    <span className={styles.mention}>
      <span className={styles.icon}>
        <Bot size={14} />
      </span>
      @{label}
    </span>
  );
});
