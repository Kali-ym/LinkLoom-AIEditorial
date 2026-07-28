import { createStaticStyles } from 'antd-style';

/** §C.1 — NavPanel shell topbar + scroll body（自 index-html.css 迁出） */
export const sidebarShellStyles = createStaticStyles(({ css, cssVar }) => ({
  topbar: css`
    flex: 0 0 auto;
    flex-shrink: 0;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};

    button {
      flex-shrink: 0;
    }
  `,
  agentHeader: css`
    flex: 1;
    min-width: 0;
    position: relative;
  `,
  body: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 4px 12px;
  `,
}));
