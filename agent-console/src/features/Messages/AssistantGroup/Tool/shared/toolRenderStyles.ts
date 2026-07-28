import { createStaticStyles } from 'antd-style';

/** Shared shell & list chrome for tool inspector render views */
export const toolRenderStyles = createStaticStyles(({ css, cssVar }) => ({
  shell: css`
    overflow: hidden;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  `,
  panel: css`
    overflow: hidden;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 55%, ${cssVar.colorBgContainer}) 0%,
      ${cssVar.colorBgContainer} 100%
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorBgContainer} 70%, transparent),
      0 1px 2px color-mix(in srgb, ${cssVar.colorText} 4%, transparent);
  `,
  panelHeader: css`
    display: flex;
    gap: 10px;
    align-items: center;
    padding-block: 11px;
    padding-inline: 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 65%, ${cssVar.colorBgContainer});
  `,
  panelHeaderIcon: css`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: ${cssVar.colorPrimary};
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 72%, ${cssVar.colorBgContainer});
    box-shadow: inset 0 1px 0 color-mix(in srgb, ${cssVar.colorBgContainer} 55%, transparent);
  `,
  panelHeaderTitle: css`
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorText};
    letter-spacing: 0.01em;
  `,
  panelBadge: css`
    flex-shrink: 0;
    padding-block: 2px;
    padding-inline: 8px;
    border-radius: 999px;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
  `,
  row: css`
    padding-block: 10px;
    padding-inline: 12px;
    border-block-end: 1px dashed color-mix(in srgb, ${cssVar.colorBorderSecondary} 85%, transparent);

    &:last-child {
      border-block-end: none;
    }
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    padding-block: 3px;
    padding-inline: 9px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;
    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillQuaternary};
  `,
  bodyPad: css`
    padding: 12px;
  `,
}));
