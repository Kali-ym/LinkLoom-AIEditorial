import { createStaticStyles } from 'antd-style';

/** Shared DraggablePanel shells — §B layout geometry */
export const panelStyles = createStaticStyles(({ css, cssVar }) => ({
  navPanel: css`
    user-select: none;
    z-index: 11;
    height: 100%;
    background: ${cssVar.colorBgLayout};
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  navPanelContent: css`
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    max-height: 100%;
  `,
  portalDrawer: css`
    z-index: 10;
    height: 100%;
    background: ${cssVar.colorBgContainer};
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  portalContent: css`
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    max-height: 100%;
    background: ${cssVar.colorBgContainer};
  `,
  rightPanel: css`
    height: 100%;
    background: ${cssVar.colorBgContainer};
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  portalBody: css`
    overflow: hidden;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    background: ${cssVar.colorBgLayout};
  `,
  rightPanelContent: css`
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    max-height: 100%;
    background: ${cssVar.colorBgLayout};
  `,
}));
