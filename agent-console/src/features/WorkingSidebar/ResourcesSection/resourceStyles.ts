import { createStaticStyles } from 'antd-style';

/** §C.27*/
export const resourceStyles = createStaticStyles(({ css, cssVar }) => ({
  section: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  `,
  pills: css`
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    padding: 0 4px;
  `,
  pillTab: css`
    cursor: pointer;
    user-select: none;

    padding-block: 4px;
    padding-inline: 12px;
    border: none;
    border-radius: 999px;

    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextSecondary};

    background: transparent;

    transition:
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut},
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  pillActive: css`
    font-weight: 500;
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillSecondary};
    box-shadow: inset 0 0 0 1px ${cssVar.colorBorderSecondary};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  content: css`
    overflow: hidden;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  `,
  webCard: css`
    cursor: pointer;

    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;

    text-align: left;

    background: ${cssVar.colorBgContainer};
    box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorText} 4%, transparent);

    transition:
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      border-color: ${cssVar.colorBorder};
      background: ${cssVar.colorFillTertiary};
      box-shadow: ${cssVar.boxShadowSecondary};
    }
  `,
  webCardActive: css`
    border-color: ${cssVar.colorPrimaryBorder};
    background: ${cssVar.colorPrimaryBg};
    box-shadow: 0 0 0 1px color-mix(in srgb, ${cssVar.colorPrimary} 12%, transparent);
  `,
  webDescription: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  webMeta: css`
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  webTitle: css`
    font-weight: 500;
  `,
}));
