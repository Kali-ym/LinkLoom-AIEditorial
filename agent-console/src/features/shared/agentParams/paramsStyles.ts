import { createStaticStyles, cssVar } from 'antd-style';

import { proseWrap } from '../../../styles/scrollMixins';

export const paramsStyles = createStaticStyles(({ css }) => ({
  advancedContent: css`
    display: flex;
    flex-direction: column;
  `,
  body: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding-block: 12px 16px;
    padding-inline: 12px;
    ${proseWrap}
  `,
  commonSection: css`
    display: flex;
    flex-direction: column;
  `,
  divider: css`
    display: none;
  `,
  form: css`
    margin: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  `,
  header: css`
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding-block: 14px;
    padding-inline: 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 55%, ${cssVar.colorBgContainer});
  `,
  headerIcon: css`
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
  headerTitle: css`
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorText};
    letter-spacing: 0.01em;
  `,
  hint: css`
    padding-block-start: 2px;
    font-size: 12px;
    line-height: 1.45;
    color: ${cssVar.colorTextTertiary};
  `,
  label: css`
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  modelConfigSection: css`
    display: flex;
    flex-direction: column;
    padding-block: 4px 8px;
    padding-inline: 2px;
  `,
  muted: css`
    .control-label {
      color: ${cssVar.colorTextTertiary};
    }
  `,
  panel: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    background: ${cssVar.colorBgContainer};
  `,
  rowControl: css`
    width: 100%;
    padding-block-start: 2px;
  `,
  rowRoot: css`
    padding-block: 12px;
    padding-inline: 14px;
    border-block-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 68%, transparent);
    transition: background-color 0.15s ${cssVar.motionEaseOut};

    &:last-child {
      border-block-end: none;
    }

    &:hover {
      background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 38%, transparent);
    }
  `,
  sectionBlock: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 48%, ${cssVar.colorBgContainer}) 0%,
      ${cssVar.colorBgContainer} 100%
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorBgContainer} 70%, transparent),
      0 1px 2px color-mix(in srgb, ${cssVar.colorText} 3%, transparent);
  `,
  sectionBody: css`
    border-block-start: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
  `,
  sectionHeader: css`
    cursor: pointer;
    width: 100%;
    padding-block: 11px;
    padding-inline: 14px;
    border: none;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorText};
    text-align: start;
    background: transparent;
    transition:
      background-color 0.15s ${cssVar.motionEaseOut},
      color 0.15s ${cssVar.motionEaseOut};

    &:hover {
      background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 45%, transparent);
    }
  `,
  sectionHeaderMeta: css`
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextTertiary};
  `,
  settingsCard: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 48%, ${cssVar.colorBgContainer}) 0%,
      ${cssVar.colorBgContainer} 100%
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorBgContainer} 70%, transparent),
      0 1px 2px color-mix(in srgb, ${cssVar.colorText} 3%, transparent);
  `,
  slider: css`
    width: 100%;
  `,
  tag: css`
    display: inline-flex;
    align-self: flex-start;
    padding-block: 2px;
    padding-inline: 7px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 85%, transparent);
    border-radius: 6px;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 10px;
    font-weight: 500;
    line-height: 1.35;
    color: ${cssVar.colorTextTertiary};
    background: ${cssVar.colorFillTertiary};
  `,
  textarea: css`
    width: 100%;
    min-height: 72px;
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorFillQuaternary} !important;
  `,
}));
