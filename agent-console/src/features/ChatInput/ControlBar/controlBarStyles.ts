import { createStaticStyles } from 'antd-style';

/** §C.30 — shared ControlBar chrome (mode / workspace / approval chips). */
export const controlBarStyles = createStaticStyles(({ css, cssVar }) => ({
  bar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 34px;
    margin-block-start: 2px;
    padding-block: 2px;
    padding-inline: 2px;
  `,
  chip: css`
    cursor: pointer;
    user-select: none;

    display: inline-flex;
    flex: none;
    gap: 6px;
    align-items: center;

    height: 28px;
    padding-inline: 8px;
    border: none;
    border-radius: 6px;

    font-family: inherit;
    font-size: 12px;
    font-weight: 400;
    line-height: 1;
    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;

    background: transparent;

    transition:
      color 0.15s ${cssVar.motionEaseOut},
      background 0.15s ${cssVar.motionEaseOut};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  chipDisabled: css`
    cursor: not-allowed;
    opacity: 0.5;

    &:hover {
      color: ${cssVar.colorTextSecondary};
      background: transparent;
    }
  `,
  chipIcon: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextSecondary};
  `,
  chipLabel: css`
    overflow: hidden;
    max-width: 132px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  chipChevron: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextTertiary};
  `,
  leftGroup: css`
    scrollbar-width: none;
    overflow: auto hidden;
    display: flex;
    flex: 1;
    gap: 6px;
    align-items: center;
    min-width: 0;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  menuIcon: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
  menuOption: css`
    cursor: pointer;
    width: 100%;
    padding-block: 10px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background-color 0.15s ${cssVar.motionEaseOut};

    &:hover {
      background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 55%, transparent);
    }
  `,
  menuOptionActive: css`
    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 85%, ${cssVar.colorBgContainer});
  `,
  menuOptionDesc: css`
    font-size: 12px;
    line-height: 1.45;
    color: ${cssVar.colorTextSecondary};
  `,
  menuOptionTitle: css`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  rightGroup: css`
    display: flex;
    flex: none;
    gap: 6px;
    align-items: center;
  `,
}));
