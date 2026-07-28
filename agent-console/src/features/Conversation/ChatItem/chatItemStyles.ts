import { createStaticStyles } from 'antd-style';

/** Upstream `ChatItem/style.ts` — hover time + menubar */
export const chatItemStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    position: relative;
    max-width: 100%;

    time,
    div[role='menubar'] {
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms ${cssVar.motionEaseOut};
    }

    time {
      display: inline-block;
      white-space: nowrap;
    }

    div[role='menubar'] {
      display: flex;
    }

    &:has([data-popup-open]) {
      div[role='menubar'] {
        pointer-events: unset;
        opacity: 1;
      }
    }

    &:hover {
      time,
      div[role='menubar'] {
        pointer-events: unset;
        opacity: 1;
      }
    }
  `,
  loading: css`
    position: absolute;
    inset-block-end: 0;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    color: ${cssVar.colorBgLayout};
    background: ${cssVar.colorPrimary};
  `,
  loadingLeft: css`
    inset-inline-start: -4px;
    inset-inline-end: unset;
  `,
  loadingRight: css`
    inset-inline-start: unset;
    inset-inline-end: -4px;
  `,
  bubble: css`
    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background-color: ${cssVar.colorFillTertiary};
    box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorText} 4%, transparent);
  `,
  disabled: css`
    user-select: none;
    color: ${cssVar.colorTextSecondary};
  `,
  messageBody: css`
    position: relative;
    overflow: hidden;
    max-width: 100%;
  `,
}));
