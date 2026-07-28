import { createStaticStyles, keyframes } from 'antd-style';

const shine = keyframes`
  0% { background-position: 100%; }
  100% { background-position: -100%; }
`;

/** Mirrored from `styles/loading.ts` — Thinking / Tool executing titles */
export const shinyTextStyles = createStaticStyles(({ css, cssVar }) => ({
  shinyText: css`
    color: color-mix(in srgb, ${cssVar.colorText} 45%, transparent);
    background: linear-gradient(
      120deg,
      color-mix(in srgb, ${cssVar.colorTextBase} 0%, transparent) 40%,
      ${cssVar.colorTextSecondary} 50%,
      color-mix(in srgb, ${cssVar.colorTextBase} 0%, transparent) 60%
    );
    background-clip: text;
    background-size: 200% 100%;
    animation: ${shine} 1.5s linear infinite;
  `,
}));
