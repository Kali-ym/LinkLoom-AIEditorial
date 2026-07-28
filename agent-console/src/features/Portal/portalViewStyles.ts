import { createStaticStyles } from 'antd-style';

/** §C.21 Portal 子视图共享样式 — cssVar 语义 token */
export const portalViewStyles = createStaticStyles(({ css, cssVar }) => ({
  bodyRoot: css`
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  `,
  scrollBody: css`
    flex: 1;
    min-height: 0;
    overflow: auto;
  `,
  artifactBody: css`
    overflow: hidden;
    padding-block-end: 12px;
  `,
  homeFileItem: css`
    cursor: pointer;
    max-width: 420px;
    padding: 8px 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
    text-align: start;
    box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorText} 4%, transparent);
    transition:
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      border-color: ${cssVar.colorBorder};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  homeSkillItem: css`
    cursor: pointer;
    padding: 10px 8px 10px 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;
    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowSecondary};
    text-align: start;
    transition:
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      border-color: ${cssVar.colorBorder};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  homeEmpty: css`
    margin-inline: 12px;
    padding-block: 24px;
    border: 1px dashed ${cssVar.colorSplit};
    border-radius: 8px;
  `,
  notebookItem: css`
    cursor: pointer;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: ${cssVar.colorFillTertiary};
    text-align: start;
    transition: background ${cssVar.motionDurationFast};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  frontmatterCard: css`
    margin: 16px 12px;
    padding: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 10px;
    background: ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowSecondary};
    overflow: hidden;
  `,
  metadataRow: css`
    display: flex;
    gap: 12px;
    padding: 10px 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    &:last-child {
      border-block-end: none;
    }
  `,
  metadataKey: css`
    flex-shrink: 0;
    width: 112px;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  todoCard: css`
    margin: 12px;
    padding: 12px;
    border-radius: 8px;
    background: ${cssVar.colorBgElevated};
    transition: background ${cssVar.motionDurationFast};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  todoProgressTrack: css`
    height: 4px;
    border-radius: 2px;
    background: ${cssVar.colorFillSecondary};
    overflow: hidden;
  `,
  todoProgressFill: css`
    height: 100%;
    background: ${cssVar.colorSuccess};
    transition: width ${cssVar.motionDurationMid};
  `,
  verifyBadge: css`
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  `,
  verifyCard: css`
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorFillQuaternary};
  `,
  verifyTrack: css`
    height: 8px;
    border-radius: 4px;
    background: ${cssVar.colorFillSecondary};
    overflow: hidden;
  `,
  threadHeader: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  localFileTab: css`
    cursor: pointer;
    max-width: 160px;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    transition:
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }

    &[data-active='true'] {
      font-weight: 500;
      color: ${cssVar.colorText};
      border-color: ${cssVar.colorBorderSecondary};
      background: ${cssVar.colorFillSecondary};
      box-shadow: inset 0 0 0 1px ${cssVar.colorBorderSecondary};
    }
  `,
  dirtyDot: css`
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-inline-start: 4px;
    border-radius: 50%;
    background: ${cssVar.colorPrimary};
    vertical-align: middle;
  `,
}));
