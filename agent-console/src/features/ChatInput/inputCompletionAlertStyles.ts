import { createStaticStyles } from 'antd-style';

/** §A cssVar — index.html `#inputCompletionAlert` */
export const inputCompletionAlertStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    display: none;
    margin-bottom: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: ${cssVar.colorWarningBg};
    border: 1px solid ${cssVar.colorWarningBorder};
    font-size: 12px;
    color: ${cssVar.colorText};
  `,
  visible: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
  `,
  warningIcon: css`
    flex-shrink: 0;
    margin-top: 2px;
    color: ${cssVar.colorWarning};
  `,
  title: css`
    font-size: 13px;
  `,
  description: css`
    margin: 2px 0 0;
    color: ${cssVar.colorTextDescription};
    font-size: 12px;
  `,
  retryButton: css`
    margin-top: 6px;
    font-size: 12px;
    padding: 4px 10px;
  `,
}));
