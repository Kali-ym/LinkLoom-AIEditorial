import { createStaticStyles } from 'antd-style';

import { MOBILE_VIEWPORT_MAX } from '../stores/types';

/** §Phase 5 — mobile touch + overflow guardrails */
export const MOBILE_MAX_WIDTH_PX = MOBILE_VIEWPORT_MAX;

export const mobileStyles = createStaticStyles(({ css, cssVar }) => ({
  pageOverflowGuard: css`
    @media (max-width: ${MOBILE_MAX_WIDTH_PX}px) {
      overflow-x: hidden;
      max-width: 100vw;
    }
  `,
  touchTarget: css`
    @media (max-width: ${MOBILE_MAX_WIDTH_PX}px) {
      min-width: 44px;
      min-height: 44px;
    }
  `,
  safeBottomPad: css`
    @media (max-width: ${MOBILE_MAX_WIDTH_PX}px) {
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  `,
  horizontalScrollStrip: css`
    @media (max-width: ${MOBILE_MAX_WIDTH_PX}px) {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  `,
  backdropMobile: css`
    @media (max-width: 1023px) {
      backdrop-filter: blur(2px);
    }
  `,
  commandMenuMobile: css`
    @media (max-width: ${MOBILE_MAX_WIDTH_PX}px) {
      align-items: flex-end;
      padding-block: 0 max(12px, env(safe-area-inset-bottom, 0px));
      padding-inline: 12px;
    }
  `,
  commandRootMobile: css`
    @media (max-width: ${MOBILE_MAX_WIDTH_PX}px) {
      width: 100%;
      max-height: min(72vh, calc(100dvh - env(safe-area-inset-top, 0px) - 24px));
      border-end-start-radius: ${cssVar.borderRadiusLG};
      border-end-end-radius: ${cssVar.borderRadiusLG};
    }
  `,
}));
