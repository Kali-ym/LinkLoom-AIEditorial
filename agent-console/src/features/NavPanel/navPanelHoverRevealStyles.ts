import { createStaticStyles } from 'antd-style';

export const NAV_PANEL_TOGGLE_WRAP_CLASS = 'nav-panel-toggle-wrap';

/** §C.1 / GAPS §A — collapsed NavPanel left-edge hover reveal (0→32px) */
export const navPanelHoverRevealStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    position: fixed;
    z-index: 12;
    inset-block: 0;
    inset-inline-start: 0;
    width: 14px;
    pointer-events: auto;

    @media (max-width: 1023px) {
      display: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .${NAV_PANEL_TOGGLE_WRAP_CLASS} {
        width: 32px;
        opacity: 1;
      }
    }

    &:hover .${NAV_PANEL_TOGGLE_WRAP_CLASS},
    &:focus-within .${NAV_PANEL_TOGGLE_WRAP_CLASS} {
      width: 32px;
      opacity: 1;
    }
  `,
  buttonWrap: css`
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 4px;
    transform: translateY(-50%);

    display: flex;
    align-items: center;
    justify-content: center;

    width: 0;
    height: 32px;
    overflow: hidden;
    opacity: 0;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowSecondary};

    transition:
      width ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      opacity ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};
  `,
}));
