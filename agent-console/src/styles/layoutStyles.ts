import { createStaticStyles } from 'antd-style';

import { NAV_HEADER_HEIGHT } from '../constants/layoutTokens';

export const layoutStyles = createStaticStyles(({ css, cssVar }) => ({
  page: css`
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    overflow: hidden;
    color: ${cssVar.colorText};
    background: ${cssVar.colorBgContainer};

    @media (max-width: 767px) {
      overflow-x: hidden;
      max-width: 100vw;
    }
  `,
  chatWorkspace: css`
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
    background: ${cssVar.colorBgLayout};
    overflow: hidden;

    @media (max-width: 767px) {
      max-width: 100%;
    }
  `,
  chatWorkspaceInner: css`
    flex: 1;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  `,
  conversationColumn: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    position: relative;
    background: ${cssVar.colorBgLayout};
  `,
  chatHeader: css`
    flex-shrink: 0;
    height: ${NAV_HEADER_HEIGHT}px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-inline: 16px;
    background: ${cssVar.colorBgContainer};
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
    position: relative;
  `,
  conversationBody: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  `,
  chatScroll: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: ${cssVar.colorBgLayout};
    /* Programmatic scroll (streaming follow, topic switch snap) must be instant.
       Smooth scrolling is only used for the explicit BackBottom button click. */
    scroll-behavior: auto;
    overflow-anchor: auto;
  `,
  chatInner: css`
    width: 100%;
    padding: 24px 0 16px;

    .messages {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
  `,
  inputArea: css`
    flex-shrink: 0;
    width: 100%;
  `,
  rightPanel: css`
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: ${cssVar.colorBgContainer};
    border-left: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));
