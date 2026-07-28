import { createStaticStyles, cssVar } from 'antd-style';

export const sharePopoverStyles = createStaticStyles(({ css }) => ({
  container: css`
    padding: 16px;
    width: 100%;
  `,
  hint: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  divider: css`
    margin: 4px 0;
    border-top: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));
