import { createStaticStyles } from 'antd-style';

/** §C.19 — running / unread avatar badges. */
export const agentListStyles = createStaticStyles(({ css, cssVar }) => ({
  runningBadge: css`
    pointer-events: none;
    position: absolute;
    inset-block-end: -3px;
    inset-inline-end: -3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: 1.5px solid ${cssVar.colorBgContainer};
    border-radius: 999px;
    color: ${cssVar.colorWarning};
    background: ${cssVar.colorBgContainer};
  `,
  unreadBadge: css`
    pointer-events: none;
    position: absolute;
    inset-block-end: -3px;
    inset-inline-end: -3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 14px;
    height: 14px;
    padding-inline: 3px;
    border: 1.5px solid ${cssVar.colorBgContainer};
    border-radius: 999px;
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    color: #fff;
    background: ${cssVar.colorError};
  `,
  avatarWrap: css`
    position: relative;
    display: inline-flex;
  `,
  groupItemIndent: css`
    padding-inline-start: 14px;
  `,
}));
