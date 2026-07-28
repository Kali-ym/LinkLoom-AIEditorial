import { createStaticStyles } from 'antd-style';

import {
  MINIMAP_PREVIEW_MAX_WIDTH,
  MINIMAP_PREVIEW_MIN_WIDTH,
} from '../../../constants/layoutTokens';

/** §C — ChatMiniMap rail + hover preview (自 index-html.css 迁出) */
export const minimapStyles = createStaticStyles(({ css, cssVar }) => ({
  root: css`
    pointer-events: none;
    position: absolute;
    z-index: 30;
    inset-block: 16px 120px;
    inset-inline-end: 8px;
    width: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;

    @media (max-width: 767px) {
      display: none !important;
    }
  `,
  rootHidden: css`
    display: none !important;
  `,
  hoverArea: css`
    pointer-events: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  `,
  rail: css`
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    align-items: flex-end;
    max-height: 50vh;
    scrollbar-width: none;
    transition: opacity 0.2s ease;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  railFaded: css`
    pointer-events: none;
    opacity: 0;
  `,
  railDense: css`
    & button {
      height: 8px;
      padding-block: 2px;
    }

    & button span {
      border-radius: 1px;
    }
  `,
  indicator: css`
    cursor: pointer;
    flex-shrink: 0;
    min-width: 5px;
    height: 12px;
    padding-block: 5px;
    padding-inline: 0;
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  `,
  indicatorBar: css`
    width: 100%;
    height: 100%;
    border-radius: 2px;
    background: ${cssVar.colorFillSecondary};
    transition:
      background 0.15s,
      width 0.15s;
  `,
  indicatorHover: css`
    &:hover span {
      background: ${cssVar.colorFill};
    }
  `,
  indicatorActive: css`
    & span {
      background: ${cssVar.colorPrimary};
    }

    &:hover span {
      background: ${cssVar.colorPrimary};
    }
  `,
  previewPanel: css`
    pointer-events: none;
    position: absolute;
    top: 50%;
    right: 0;
    transform: translateY(-50%) scale(0.96);
    transform-origin: 100% 50%;
    overflow: hidden;
    display: flex;
    min-width: ${MINIMAP_PREVIEW_MIN_WIDTH}px;
    max-width: ${MINIMAP_PREVIEW_MAX_WIDTH}px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    opacity: 0;
    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowSecondary};
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;

    @media (max-width: 767px) {
      min-width: 200px;
      max-width: min(320px, calc(100vw - 32px));
    }

    @media (max-width: 480px) {
      left: auto;
      right: 0;
      transform: translateY(-50%) scale(1);
      transform-origin: 100% 50%;
    }
  `,
  previewPanelVisible: css`
    pointer-events: auto;
    transform: translateY(-50%) scale(1);
    opacity: 1;

    @media (max-width: 480px) {
      transform: translateY(-50%) scale(1);
    }
  `,
  previewList: css`
    overflow-y: auto;
    max-height: 60vh;
    padding: 4px;
    scrollbar-width: thin;
    width: 100%;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 2px;
      background: ${cssVar.colorFillSecondary};
    }
  `,
  previewItem: css`
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 6px 12px;
    border-radius: 6px;
    color: ${cssVar.colorTextDescription};
    transition:
      background 0.15s,
      color 0.15s;
    border: 0;
    background: transparent;
    width: 100%;
    text-align: right;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  previewItemActive: css`
    color: ${cssVar.colorText};
  `,
  previewLabel: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    font-size: 13px;
    line-height: 1.4;
    text-align: end;
    word-break: break-word;
    flex: 1;
    min-width: 0;
  `,
  previewLabelActive: css`
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  previewDash: css`
    flex-shrink: 0;
    height: 2px;
    border-radius: 2px;
    background: ${cssVar.colorFillSecondary};
  `,
  previewDashActive: css`
    background: ${cssVar.colorPrimary};
  `,
  previewLabelStandalone: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    font-size: 12px;
    line-height: 1.4;
    text-align: end;
    word-break: break-word;
    padding: 8px;
    max-width: 280px;
  `,
}));
