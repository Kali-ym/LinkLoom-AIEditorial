import { createStaticStyles, cssVar } from 'antd-style';

export const reactionStyles = createStaticStyles(({ css }) => ({
  emojiButton: css`
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: ${cssVar.borderRadius};
    font-size: 18px;
    transition: all 0.2s;

    &:hover {
      transform: scale(1.1);
      background: ${cssVar.colorFillSecondary};
    }
  `,
  moreButton: css`
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: ${cssVar.borderRadius};
    color: ${cssVar.colorTextTertiary};
    transition: all 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  pickerContainer: css`
    padding: 4px;
    max-width: 220px;
  `,
  emojiMartContainer: css`
    overflow: hidden;
    border-radius: ${cssVar.borderRadius};
  `,
}));

export const QUICK_REACTIONS = ['👍', '👎', '❤️', '😄', '😂', '😅', '🎉', '😢', '🤔', '🚀'] as const;
