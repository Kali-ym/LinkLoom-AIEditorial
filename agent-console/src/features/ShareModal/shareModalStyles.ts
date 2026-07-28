import { createStaticStyles, responsive } from 'antd-style';

export const shareModalStyles = createStaticStyles(({ css, cssVar }) => ({
  body: css`
    flex: 1;
    min-height: 0;
    height: 100%;

    ${responsive.sm} {
      padding-block-end: 68px;
    }
  `,
  footer: css`
    ${responsive.sm} {
      position: absolute;
      inset-block-end: 0;
      inset-inline: 0;

      width: 100%;
      margin: 0;
      padding: 16px;

      background: ${cssVar.colorBgContainer};
    }
  `,
  preview: css`
    overflow: hidden scroll;

    flex: 1;
    min-width: 0;
    max-height: 70dvh;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};

    ${responsive.sm} {
      max-height: 40dvh;
    }
  `,
  previewNarrow: css`
    max-width: 480px;
    margin-inline: auto;
  `,
  sidebar: css`
    flex: none;
    width: max(240px, 25%);

    ${responsive.sm} {
      flex: 1;
      width: unset;
      margin-inline: -16px;
    }
  `,
}));
