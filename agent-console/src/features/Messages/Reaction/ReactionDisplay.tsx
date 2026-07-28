import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';

import { useChatStore } from '../../../stores/chatStore';
import { EMPTY_REACTIONS } from '../../../selectors/storeSelectors';
import { ReactionPicker } from './ReactionPicker';

const styles = createStaticStyles(({ css }) => ({
  tag: css`
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding-inline: 10px;
    border-radius: 14px;
    font-size: 14px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillSecondary};
  `,
}));

/** §C.59 — 已有 reactions 行尾展示 + picker */
export const ReactionDisplay = memo(function ReactionDisplay({ messageId }: { messageId: string }) {
  const reactions = useChatStore((s) => s.reactions[messageId] ?? EMPTY_REACTIONS);

  if (reactions.length === 0) return null;

  return (
    <Flexbox horizontal align="center" gap={8} style={{ marginTop: 8 }}>
      {reactions.map((emoji) => (
        <span key={emoji} className={styles.tag}>
          {emoji}
        </span>
      ))}
      <ReactionPicker messageId={messageId} />
    </Flexbox>
  );
});
