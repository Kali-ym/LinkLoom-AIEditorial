import { createStaticStyles } from 'antd-style';

/** §C.13 — shared overlay panel tokens (QueueTray / TodoProgress / OpStatusTray). */
export const overlayStackStyles = createStaticStyles(({ css, cssVar }) => ({
  stack: css`
    display: flex;
    flex-direction: column;
    width: 100%;

    /* Narrow viewports: trays stack in document flow above the input card. */
    @media (max-width: 767px) {
      position: relative;
      z-index: auto;
      inset: unset;
    }

    @media (min-width: 768px) {
      position: absolute;
      z-index: 10;
      inset-block-end: 100%;
      inset-inline: 0;
    }
  `,
  panel: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-block-end: none;
    border-start-start-radius: 12px;
    border-start-end-radius: 12px;
    background: ${cssVar.colorBgContainer};
  `,
  panelTopAttached: css`
    border-start-start-radius: 0;
    border-start-end-radius: 0;
  `,
  itemDivider: css`
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));
