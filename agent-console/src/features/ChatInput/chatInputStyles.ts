import { createStaticStyles } from 'antd-style';

import {
  CHAT_INPUT_DESKTOP_MAX_HEIGHT,
} from '../../constants/layoutTokens';

/** §C.4 — DesktopChatInput container + shell. */
export const chatInputStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    .show-on-hover {
      opacity: 0;
    }

    &:hover {
      .show-on-hover {
        opacity: 1;
      }
    }
  `,
  chatInputArea: css`
    position: relative;
    z-index: 25;
    flex: 0 0 auto;
    flex-shrink: 0;
    padding: 0 0 12px;
    overflow: visible;
    background: ${cssVar.colorBgLayout};

    &::before {
      content: '';
      pointer-events: none;
      position: absolute;
      z-index: 0;
      inset-block-start: -28px;
      inset-inline: 0;
      height: 28px;
      background: linear-gradient(
        to bottom,
        color-mix(in srgb, ${cssVar.colorBgLayout} 0%, transparent),
        ${cssVar.colorBgLayout}
      );
    }

    @media (max-width: 767px) {
      padding: 0 12px calc(12px + env(safe-area-inset-bottom, 0px));
    }
  `,
  inputWrap: css`
    position: relative;
    max-width: 100%;
    margin: 0;
    min-width: 0;

    @media (max-width: 767px) {
      max-width: 100%;
      width: 100%;
    }
  `,
  inputWrapFullscreen: css`
    max-width: 100%;
  `,
  inputCardAnchor: css`
    position: relative;
  `,
  inputCardAnchorGrouped: css`
    filter: drop-shadow(0 2px 8px color-mix(in srgb, ${cssVar.colorText} 7%, transparent));
  `,
  inputCard: css`
    position: relative;
    z-index: 1;
    display: flex;
    overflow: visible;
    flex-direction: column;
    min-height: 88px;
    max-height: ${CHAT_INPUT_DESKTOP_MAX_HEIGHT}px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowSecondary};
    transition:
      border-color ${cssVar.motionDurationMid},
      box-shadow ${cssVar.motionDurationMid};

    &:hover {
      border-color: ${cssVar.colorBorder};
    }

    &:focus-within {
      border-color: ${cssVar.colorPrimaryBorder};
      box-shadow:
        ${cssVar.boxShadowSecondary},
        0 0 0 3px color-mix(in srgb, ${cssVar.colorPrimary} 10%, transparent);
    }

    & > div[class*='lobe'] {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    & [class*='lobe'] [class*='editor'],
    & [class*='lobe'] [class*='content'] {
      background: transparent !important;
    }

    & .lobe-chat-input-footer-slot:empty {
      display: none;
    }

    &.resizing {
      transition: none;
    }

    & .input-resize-handle {
      position: relative;
      flex-shrink: 0;
      height: 6px;
      cursor: ns-resize;
    }

    & .input-resize-handle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 32px;
      height: 3px;
      border-radius: 2px;
      background: ${cssVar.colorFillSecondary};
      opacity: 0;
      transition: opacity ${cssVar.motionDurationMid};
    }

    &:hover .input-resize-handle::after,
    &.resizing .input-resize-handle::after {
      opacity: 1;
    }
  `,
  inputCardHasTray: css`
    border-block-start: none;
    border-start-start-radius: 0;
    border-start-end-radius: 0;
    border-radius: 0 0 12px 12px;
    box-shadow: none;
  `,
  inputCardExpanded: css`
    z-index: 55;
    height: calc(100dvh - 80px);
    max-height: calc(100dvh - 80px);
    border-radius: 12px;
    box-shadow: 0 -12px 40px color-mix(in srgb, ${cssVar.colorText} 12%, transparent);

    & > div[class*='lobe'] {
      height: 100%;
    }

    & > div[class*='lobe'] > *,
    & [class*='lobe'] [class*='content'],
    & [class*='lobe'] [class*='editor'],
    & [class*='lobe'] [class*='body'] {
      flex: 1;
      min-height: 0;
      max-height: none !important;
    }

    & > div[class*='lobe'] > * {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `,
  inputCardHeader: css`
    flex-shrink: 0;
  `,
  inputEditorWrap: css`
    position: relative;
    flex: 1;
    min-height: 44px;
  `,
  inputEditorInner: css`
    display: block;
    height: 100%;
    min-height: 44px;
  `,
  inputEditorWrapExpanded: css`
    flex: 1;
    min-height: 0;
    max-height: none !important;
  `,
  fullscreen: css`
    position: absolute;
    z-index: 100;
    inset: 0;

    width: 100%;
    height: 100%;
    margin-block-start: 0;

    background: ${cssVar.colorBgContainer};
  `,
  inputFullscreen: css`
    border: none;
    border-radius: 0 !important;
  `,
  inputRadius: css`
    .lobe-chat-input {
      border-radius: 12px;
    }
  `,
  sendButton: css``,
  sendButtonReady: css`
    &.ant-btn-primary:not(:disabled) {
      border-color: ${cssVar.colorText} !important;
      background: ${cssVar.colorText} !important;
      color: ${cssVar.colorBgLayout} !important;
    }

    &.ant-btn-primary:not(:disabled):hover {
      border-color: ${cssVar.colorText} !important;
      background: color-mix(in srgb, ${cssVar.colorText} 88%, ${cssVar.colorBgLayout}) !important;
      color: ${cssVar.colorBgLayout} !important;
    }
  `,
}));
