import { createStaticStyles } from 'antd-style';

/** §C.27*/
export const skillsListStyles = createStaticStyles(({ css, cssVar }) => ({
  chevron: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextTertiary};
    transition: transform ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut};
  `,
  chevronExpanded: css`
    transform: rotate(90deg);
  `,
  childItem: css`
    cursor: pointer;

    height: 26px;
    padding-inline-end: 8px;
    border-radius: 6px;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  childItemIcon: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextTertiary};
  `,
  description: css`
    max-width: 320px;
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  item: css`
    cursor: pointer;

    height: 28px;
    padding-inline: 4px 8px;
    border-radius: 6px;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};

    transition:
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }

    &:hover .skill-row-actions {
      display: flex;
    }

    &:hover .skill-row-count {
      display: none;
    }
  `,
  itemCount: css`
    flex-shrink: 0;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorTextTertiary};
  `,
  rowAction: css`
    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 20px;
    height: 20px;
    border-radius: 4px;

    color: ${cssVar.colorTextTertiary};

    transition: all 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  rowActionDanger: css`
    &:hover {
      color: ${cssVar.colorError};
      background: ${cssVar.colorErrorBg};
    }
  `,
  rowActionDisabled: css`
    cursor: not-allowed;
    color: ${cssVar.colorTextQuaternary};

    &:hover {
      color: ${cssVar.colorTextQuaternary};
      background: transparent;
    }
  `,
  rowActions: css`
    display: none;
    flex: none;
    gap: 2px;
    align-items: center;
  `,
  itemIcon: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextTertiary};
  `,
  treeChevronSlot: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;

    width: 14px;
    height: 14px;
  `,
}));
