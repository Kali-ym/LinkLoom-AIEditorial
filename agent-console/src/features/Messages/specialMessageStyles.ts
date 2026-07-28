import { createStaticStyles } from 'antd-style';

/** §A cssVar — §C.17 特殊消息类型（自 index-html.css 迁出） */

export const taskMessageStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 10px;
    padding: 12px 14px;
    background: ${cssVar.colorBgContainer};
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  `,
  status: css`
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: ${cssVar.colorSuccessBg};
    color: ${cssVar.colorSuccess};
    font-weight: 500;
  `,
  title: css`
    font-size: 13px;
    font-weight: 600;
  `,
  description: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
}));

export const supervisorMessageStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    padding: 10px 14px;
    border-radius: 10px;
    background: ${cssVar.colorWarningBg};
    border: 1px solid ${cssVar.colorWarningBorder};
    font-size: 13px;
    color: ${cssVar.colorTextDescription};

    strong {
      color: ${cssVar.colorText};
      font-weight: 600;
    }
  `,
}));

export const compressedGroupMessageStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    border: 1px dashed ${cssVar.colorBorder};
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: ${cssVar.colorTextDescription};
    cursor: pointer;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

export const toolStandaloneMessageStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    border-left: 3px solid ${cssVar.colorPrimary};
    padding: 8px 12px;
    background: ${cssVar.colorPrimaryBg};
    border-radius: 0 8px 8px 0;
    font-size: 13px;
  `,
}));
