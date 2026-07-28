import { createStaticStyles, cssVar, keyframes } from 'antd-style';

const enter = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const agentHomeStyles = createStaticStyles(({ css }) => ({
  root: css`
    position: relative;

    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;

    width: 100%;
    max-width: 680px;
    min-height: min(68dvh, 100%);
    margin-inline: auto;
    padding-block: clamp(28px, 6vh, 56px) max(5vh, 24px);
    padding-inline: 24px;

    @media (max-width: 767px) {
      min-height: min(60dvh, 100%);
      padding-inline: 16px;
      padding-block: clamp(20px, 5vh, 40px) max(3vh, 16px);
    }
  `,
  ambient: css`
    pointer-events: none;

    position: absolute;
    z-index: 0;
    inset: 0;

    overflow: hidden;

    &::before {
      content: '';

      position: absolute;
      top: -10%;
      left: -6%;

      width: min(460px, 92%);
      height: min(340px, 58%);

      opacity: 0.5;
      background: radial-gradient(
        ellipse at center,
        color-mix(in srgb, ${cssVar.colorPrimary} 16%, transparent) 0%,
        transparent 70%
      );
      filter: blur(44px);
    }

    @media (prefers-reduced-motion: reduce) {
      &::before {
        filter: none;
      }
    }
  `,
  content: css`
    position: relative;
    z-index: 1;

    display: flex;
    flex-direction: column;
    gap: 24px;

    width: 100%;
  `,
  hero: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  `,
  heroRow: css`
    display: flex;
    gap: 16px;
    align-items: center;
  `,
  heroCopy: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  `,
  avatarWrap: css`
    position: relative;
    flex: none;

    &::after {
      content: '';

      position: absolute;
      z-index: -1;
      inset: -8px;

      border-radius: 20px;
      opacity: 0.6;
      background: color-mix(in srgb, ${cssVar.colorPrimary} 20%, transparent);
      filter: blur(12px);
    }
  `,
  title: css`
    margin: 0;

    font-size: clamp(22px, 2.5vw, 30px);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.03em;
    text-wrap: balance;
    color: ${cssVar.colorText};
  `,
  subtitle: css`
    margin: 0;

    font-size: 14px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
    text-wrap: pretty;
  `,
  welcome: css`
    max-inline-size: 62ch;
    padding-inline-start: 2px;

    font-size: 14px;
    line-height: 1.65;
    color: ${cssVar.colorTextSecondary};
    text-wrap: pretty;

    p {
      margin-block: 0 0.65em;
    }

    p:last-child {
      margin-block-end: 0;
    }

    strong {
      font-weight: 600;
      color: ${cssVar.colorText};
    }

    code {
      padding: 1px 5px;
      border-radius: 4px;

      font-family: ${cssVar.fontFamilyCode};
      font-size: 12px;

      background: ${cssVar.colorFillTertiary};
    }
  `,
  promptsPanel: css`
    display: flex;
    flex-direction: column;
    gap: 12px;

    width: 100%;
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 14px;

    background: color-mix(in srgb, ${cssVar.colorBgElevated} 88%, ${cssVar.colorFillTertiary});
    box-shadow: 0 1px 0 color-mix(in srgb, ${cssVar.colorText} 4%, transparent);
  `,
  promptsPanelHeader: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-inline: 2px;
  `,
  promptsTitle: css`
    margin: 0;

    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    color: ${cssVar.colorText};
  `,
  promptsHint: css`
    margin: 0;

    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextDescription};
  `,
  promptList: css`
    display: flex;
    flex-direction: column;
    gap: 6px;

    width: 100%;
    margin: 0;
    padding: 0;

    list-style: none;
  `,
  promptButton: css`
    cursor: pointer;

    display: flex;
    gap: 10px;
    align-items: center;

    width: 100%;
    margin: 0;
    padding-block: 10px;
    padding-inline: 10px;
    border: 1px solid transparent;
    border-radius: 10px;

    font: inherit;
    font-size: 13px;
    line-height: 1.45;
    color: ${cssVar.colorText};
    text-align: start;

    background: ${cssVar.colorFillTertiary};

    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      transform 0.12s ease;

    animation: ${enter} 320ms cubic-bezier(0.22, 1, 0.36, 1) both;

    &:hover {
      background: ${cssVar.colorFillSecondary};
      border-color: ${cssVar.colorBorderSecondary};
    }

    &:active {
      transform: scale(0.995);
    }

    &:hover svg {
      opacity: 0.9;
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;

      &:active {
        transform: none;
      }
    }
  `,
  promptIndex: css`
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 22px;
    height: 22px;
    border-radius: 6px;

    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorTextSecondary};

    background: color-mix(in srgb, ${cssVar.colorText} 6%, transparent);
  `,
  promptText: css`
    flex: 1;
    min-width: 0;
  `,
  promptIcon: css`
    flex: none;
    opacity: 0.45;
    transition: opacity 0.15s ease;
  `,
  footerHint: css`
    margin: 0;
    padding-inline: 2px;

    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextDescription};
  `,
  kbd: css`
    display: inline-block;

    padding: 1px 5px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 5px;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 11px;
    line-height: 1.3;

    background: ${cssVar.colorFillQuaternary};
  `,
}));
