import { createStaticStyles } from 'antd-style';

import { codeBlockScroll, commandBlock, hideScrollbar, proseWrap } from '../../../styles/scrollMixins';

/** Intervention bar — theme-native approval dock */
export const interventionStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    margin-block-end: 12px;
  `,
  shell: css`
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-height: min(56vh, 520px);
    max-width: 100%;
    min-width: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorBgContainer};
    box-shadow:
      ${cssVar.boxShadowSecondary},
      0 0 0 1px color-mix(in srgb, ${cssVar.colorWarning} 8%, transparent);
  `,
  chrome: css`
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
    border-block-start: 3px solid ${cssVar.colorWarning};
    background: linear-gradient(
      135deg,
      color-mix(in srgb, ${cssVar.colorWarningBg} 42%, ${cssVar.colorBgContainer}) 0%,
      color-mix(in srgb, ${cssVar.colorBgElevated} 88%, ${cssVar.colorBgContainer}) 100%
    );

    &[data-risk='low'] {
      border-block-start-color: ${cssVar.colorSuccess};
    }

    &[data-risk='high'] {
      border-block-start-color: ${cssVar.colorError};
    }
  `,
  chromeBody: css`
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding-block: 12px 10px;
    padding-inline: 14px;
  `,
  chromeIcon: css`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-block-start: 1px;
    border-radius: 10px;
    color: ${cssVar.colorWarning};
    background: color-mix(in srgb, ${cssVar.colorWarningBg} 75%, ${cssVar.colorBgContainer});
    box-shadow: inset 0 1px 0 color-mix(in srgb, ${cssVar.colorBgContainer} 55%, transparent);

    &[data-risk='low'] {
      color: ${cssVar.colorSuccess};
      background: color-mix(in srgb, ${cssVar.colorSuccessBg} 75%, ${cssVar.colorBgContainer});
    }

    &[data-risk='high'] {
      color: ${cssVar.colorError};
      background: color-mix(in srgb, ${cssVar.colorErrorBg} 75%, ${cssVar.colorBgContainer});
    }
  `,
  chromeCopy: css`
    flex: 1;
    min-width: 0;
  `,
  chromeEyebrow: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;
    margin-block-end: 4px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: ${cssVar.colorTextTertiary};
  `,
  chromePulse: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${cssVar.colorWarning};
    box-shadow: 0 0 0 4px color-mix(in srgb, ${cssVar.colorWarning} 22%, transparent);
    animation: intervention-pulse 2s ease-in-out infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    @keyframes intervention-pulse {
      0%,
      100% {
        opacity: 1;
      }

      50% {
        opacity: 0.45;
      }
    }
  `,
  chromeTitle: css`
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.35;
    color: ${cssVar.colorText};
    overflow-wrap: anywhere;
    word-break: break-word;
  `,
  chromeSubtitle: css`
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  riskBadge: css`
    flex-shrink: 0;
    align-self: flex-start;
    margin-block-start: 1px;
    padding-block: 4px;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  `,
  risk_low: css`
    color: ${cssVar.colorSuccess};
    background: ${cssVar.colorSuccessBg};
  `,
  risk_medium: css`
    color: ${cssVar.colorWarning};
    background: ${cssVar.colorWarningBg};
  `,
  risk_high: css`
    color: ${cssVar.colorError};
    background: ${cssVar.colorErrorBg};
  `,
  content: css`
    overflow-x: hidden;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    min-width: 0;
    padding-block: 0 12px;
    padding-inline: 14px;
    background: ${cssVar.colorBgContainer};
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    ${hideScrollbar}
    ${proseWrap}
  `,
  contentInner: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    max-width: 100%;
    ${proseWrap}
  `,
  codeBlock: css`
    ${codeBlockScroll}
  `,
  commandBlock: css`
    ${commandBlock}
  `,
  commandHighlighter: css`
    width: 100%;
    min-width: 0;
    max-width: 100%;
  `,
  actions: css`
    flex-shrink: 0;
    overflow: hidden;
    padding-block: 12px;
    padding-inline: 14px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    background: color-mix(in srgb, ${cssVar.colorBgElevated} 94%, ${cssVar.colorFillTertiary});
    ${hideScrollbar}

    &:empty {
      display: none;
    }
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    max-width: 100%;
    ${proseWrap}
  `,
  sectionTitle: css`
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${cssVar.colorTextTertiary};
  `,
  sectionDesc: css`
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: ${cssVar.colorTextSecondary};
  `,
  leadTitle: css`
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.45;
    color: ${cssVar.colorText};
  `,
  leadDesc: css`
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: ${cssVar.colorTextSecondary};
  `,
  optionLabel: css`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  optionDesc: css`
    font-size: 12px;
    line-height: 1.45;
    color: ${cssVar.colorTextSecondary};
  `,
  panel: css`
    overflow: hidden;
    overflow-x: hidden;
    max-width: 100%;
    min-width: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgElevated};
    box-shadow: inset 0 1px 0 color-mix(in srgb, ${cssVar.colorBgContainer} 65%, transparent);
    ${proseWrap}
  `,
  panelPadded: css`
    padding: 12px 14px;
  `,
  panelMono: css`
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
  `,
  pathRow: css`
    display: flex;
    gap: 10px;
    align-items: flex-start;
    min-width: 0;
  `,
  pathIcon: css`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: ${cssVar.colorSuccess};
    background: color-mix(in srgb, ${cssVar.colorSuccessBg} 75%, ${cssVar.colorBgContainer});
  `,
  pathCopy: css`
    flex: 1;
    min-width: 0;
  `,
  pathLabel: css`
    display: block;
    margin-block-end: 2px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${cssVar.colorTextTertiary};
  `,
  pathValue: css`
    font-family: ${cssVar.fontFamilyCode};
    font-size: 13px;
    line-height: 1.45;
    color: ${cssVar.colorText};
    overflow-wrap: anywhere;
    word-break: break-all;
  `,
  collapseHeader: css`
    cursor: pointer;
    user-select: none;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    align-self: flex-start;
    padding-block: 6px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorBgContainer};
    transition:
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      color: ${cssVar.colorText};
      border-color: color-mix(in srgb, ${cssVar.colorPrimary} 25%, ${cssVar.colorBorderSecondary});
      background: ${cssVar.colorFillTertiary};
    }
  `,
  actionDock: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    min-width: 0;
    overflow: hidden;
  `,
  rememberRow: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  rejectField: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  rejectLabel: css`
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  rejectInput: css`
    width: 100%;
    padding-block: 8px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};
    font-family: inherit;
    font-size: 13px;
    line-height: 1.4;
    color: ${cssVar.colorText};
    background: ${cssVar.colorBgContainer};
    transition: border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &::placeholder {
      color: ${cssVar.colorTextTertiary};
    }

    &:focus,
    &:focus-visible {
      border-color: color-mix(in srgb, ${cssVar.colorError} 45%, ${cssVar.colorBorder});
      outline: none;
    }
  `,
  actionRow: css`
    display: grid;
    grid-template-columns: 1fr 1.35fr;
    gap: 8px;

    @media (max-width: 520px) {
      grid-template-columns: 1fr;
    }
  `,
  primaryBtn: css`
    && {
      font-weight: 600;
      color: ${cssVar.colorTextLightSolid};
      background: ${cssVar.colorPrimary};
      border-color: ${cssVar.colorPrimary};
      box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorPrimary} 18%, transparent);

      &:hover:not(:disabled) {
        color: ${cssVar.colorTextLightSolid};
        background: ${cssVar.colorPrimaryHover};
        border-color: ${cssVar.colorPrimaryHover};
      }

      &:active:not(:disabled) {
        color: ${cssVar.colorTextLightSolid};
        background: ${cssVar.colorPrimaryActive};
        border-color: ${cssVar.colorPrimaryActive};
      }

      &:disabled {
        color: ${cssVar.colorTextLightSolid};
        background: color-mix(in srgb, ${cssVar.colorPrimary} 42%, ${cssVar.colorBgContainer});
        border-color: transparent;
        opacity: 0.72;
      }
    }
  `,
  secondaryBtn: css`
    && {
      color: ${cssVar.colorText};
      background: ${cssVar.colorBgContainer};
      border-color: ${cssVar.colorBorderSecondary};

      &:hover:not(:disabled) {
        color: ${cssVar.colorText};
        background: ${cssVar.colorFillTertiary};
        border-color: ${cssVar.colorBorder};
      }

      &:disabled {
        color: ${cssVar.colorTextQuaternary};
        background: ${cssVar.colorBgContainer};
        border-color: ${cssVar.colorBorderSecondary};
      }
    }
  `,
  rejectBtn: css`
    && {
      height: 40px;
      border-color: ${cssVar.colorBorderSecondary};
      color: ${cssVar.colorText};
      background: ${cssVar.colorBgContainer};

      &:hover:not(:disabled) {
        border-color: color-mix(in srgb, ${cssVar.colorError} 35%, ${cssVar.colorBorder});
        color: ${cssVar.colorError};
        background: color-mix(in srgb, ${cssVar.colorErrorBg} 55%, ${cssVar.colorBgContainer});
      }
    }
  `,
  approveBtn: css`
    && {
      height: 40px;
      font-weight: 600;
      color: ${cssVar.colorTextLightSolid};
      background: ${cssVar.colorPrimary};
      border-color: ${cssVar.colorPrimary};
      box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorPrimary} 18%, transparent);

      &:hover:not(:disabled) {
        color: ${cssVar.colorTextLightSolid};
        background: ${cssVar.colorPrimaryHover};
        border-color: ${cssVar.colorPrimaryHover};
      }

      &:active:not(:disabled) {
        color: ${cssVar.colorTextLightSolid};
        background: ${cssVar.colorPrimaryActive};
        border-color: ${cssVar.colorPrimaryActive};
      }

      &:disabled {
        color: ${cssVar.colorTextLightSolid};
        background: color-mix(in srgb, ${cssVar.colorPrimary} 42%, ${cssVar.colorBgContainer});
        border-color: transparent;
        opacity: 0.72;
      }
    }
  `,
  shortcutHint: css`
    display: inline-flex;
    align-items: center;
    margin-inline-start: 6px;
    opacity: 0.7;
  `,
  selectableOption: css`
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-block: 11px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorBgElevated};
    transition:
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &[data-selected='true'] {
      border-color: color-mix(in srgb, ${cssVar.colorPrimary} 55%, ${cssVar.colorBorderSecondary});
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 82%, ${cssVar.colorBgContainer});
      box-shadow: 0 0 0 1px color-mix(in srgb, ${cssVar.colorPrimary} 18%, transparent);
    }

    &:hover:not([data-selected='true']) {
      border-color: color-mix(in srgb, ${cssVar.colorPrimary} 18%, ${cssVar.colorBorderSecondary});
      background: ${cssVar.colorFillTertiary};
    }
  `,
  selectableOptionRow: css`
    display: flex;
    gap: 10px;
    align-items: flex-start;
    min-width: 0;
  `,
  customInputRow: css`
    padding-block: 11px;
    padding-inline: 12px;
    border: 1px dashed ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 45%, ${cssVar.colorBgContainer});
    transition:
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &[data-selected='true'] {
      border-style: solid;
      border-color: color-mix(in srgb, ${cssVar.colorPrimary} 55%, ${cssVar.colorBorderSecondary});
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 82%, ${cssVar.colorBgContainer});
      box-shadow: 0 0 0 1px color-mix(in srgb, ${cssVar.colorPrimary} 18%, transparent);
    }
  `,
  choiceMark: css`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-block-start: 2px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 5px;
    font-size: 11px;
    color: ${cssVar.colorPrimary};

    &[data-selected='true'] {
      border-color: ${cssVar.colorPrimary};
      background: ${cssVar.colorPrimary};
      color: ${cssVar.colorTextLightSolid};
    }
  `,
  radioMark: css`
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-block-start: 3px;
    border: 2px solid ${cssVar.colorBorder};
    border-radius: 50%;

    &[data-selected='true'] {
      border-color: ${cssVar.colorPrimary};
      box-shadow: inset 0 0 0 3px ${cssVar.colorPrimary};
    }
  `,
  metaRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-block-start: 2px;
  `,
  metaChip: css`
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding-block: 3px;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: 11px;
    color: ${cssVar.colorTextSecondary};
    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 85%, ${cssVar.colorBgContainer});
  `,
}));
