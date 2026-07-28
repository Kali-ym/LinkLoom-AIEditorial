import { createStaticStyles } from 'antd-style';

/** §A cssVar — index.html `.msg-verify` */
export const verifyMessageStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
  `,
  head: css`
    padding: 10px 14px;
    background: ${cssVar.colorFillTertiary};
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  body: css`
    padding: 12px 14px;
    font-size: 13px;
    font-family: ${cssVar.fontFamilyCode};
    color: ${cssVar.colorTextDescription};
  `,
}));
