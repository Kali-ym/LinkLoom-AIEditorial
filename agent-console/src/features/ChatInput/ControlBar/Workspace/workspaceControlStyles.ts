import { createStaticStyles, cssVar } from 'antd-style';

/** ModeSelector 同款 Popover content 边框 */
export const popoverContentStyles = {
  content: { border: `1px solid ${cssVar.colorBorderSecondary}`, padding: 4 },
} as const;

export const workspaceStyles = createStaticStyles(({ css }) => ({
  deviceButton: css`
    cursor: pointer;
    display: flex;
    flex: none;
    gap: 6px;
    align-items: center;
    height: 28px;
    padding-inline: 8px;
    border-radius: 6px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;
    transition: all 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  chipButton: css`
    cursor: pointer;
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
  chipButtonDisabled: css`
    cursor: progress;
    opacity: 0.6;

    &:hover {
      background: transparent;
    }
  `,
  chipLabel: css`
    overflow: hidden;
    max-width: 140px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  deviceLabel: css`
    overflow: hidden;
    max-width: 120px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  separator: css`
    flex: none;
    width: 1px;
    height: 10px;
    background: ${cssVar.colorSplit};
  `,
  popoverContent: css`
    min-width: 280px;
    max-width: 320px;
    padding: 4px;
  `,
  sectionTitle: css`
    padding: 6px 8px 4px;
    font-size: 11px;
    font-weight: 500;
    color: ${cssVar.colorTextQuaternary};
  `,
  sectionTitleUpper: css`
    padding: 6px 8px 4px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${cssVar.colorTextQuaternary};
  `,
  optionRow: css`
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background 0.15s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &[data-active='true'] {
      background: ${cssVar.colorFillSecondary};
    }

    &[data-disabled='true'] {
      cursor: not-allowed;
      opacity: 0.55;
      pointer-events: none;
    }
  `,
  optionIconBox: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgContainer};
  `,
  dotOnline: css`
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${cssVar.colorSuccess};
    box-shadow: 0 0 0 2px ${cssVar.colorSuccessBg};
  `,
  dotOffline: css`
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${cssVar.colorTextQuaternary};
  `,
  dotStarting: css`
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${cssVar.colorWarning};
    box-shadow: 0 0 0 2px ${cssVar.colorWarningBg};
  `,
  dotError: css`
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${cssVar.colorError};
    box-shadow: 0 0 0 2px ${cssVar.colorErrorBg};
  `,
  sandboxFooter: css`
    display: flex;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid ${cssVar.colorBorderSecondary};
  `,
  sandboxActionButton: css`
    cursor: pointer;
    flex: 1;
    height: 28px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 6px;
    background: ${cssVar.colorBgContainer};
    font-size: 12px;
    color: ${cssVar.colorText};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `,
  statusTag: css`
    display: inline-flex;
    align-items: center;
    padding-inline: 5px;
    font-size: 10px;
    line-height: 16px;
    border-radius: ${cssVar.borderRadiusSM};
    background: ${cssVar.colorFillSecondary};
  `,
  downloadCard: css`
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px;
    border-radius: ${cssVar.borderRadius};
    text-decoration: none;
    color: inherit;
    transition: background 0.2s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  dirItem: css`
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background 0.15s;

    &:hover,
    &[data-active='true'] {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  dirName: css`
    font-size: 13px;
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  dirPath: css`
    overflow: hidden;
    font-size: 11px;
    color: ${cssVar.colorTextDescription};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  clearText: css`
    cursor: pointer;
    padding: 6px 8px 2px;
    font-size: 11px;
    font-weight: 500;
    color: ${cssVar.colorTextTertiary};
    transition: color 0.2s;

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  chooseFolderRow: css`
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px;
    border-radius: ${cssVar.borderRadius};
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
    transition: background 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  scrollContainer: css`
    overflow-y: auto;
    max-height: 360px;
  `,
  branchPopup: css`
    display: flex;
    flex-direction: column;
    width: 300px;
    height: 360px;
    margin: -4px;
  `,
  branchSearch: css`
    padding: 4px 12px;
    border-bottom: 1px solid ${cssVar.colorSplit};
  `,
  branchSectionRow: css`
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 4px 8px 2px;
  `,
  branchSectionTitle: css`
    flex: 1;
    font-size: 11px;
    font-weight: 500;
    color: ${cssVar.colorTextQuaternary};
  `,
  branchList: css`
    flex: 1;
    overflow: auto;
    padding: 2px 4px;
  `,
  branchItem: css`
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.3;
    color: ${cssVar.colorText};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &:hover .branch-row-actions {
      display: flex;
    }

    &:hover .branch-row-check {
      display: none;
    }
  `,
  branchItemCheck: css`
    flex: none;
    color: ${cssVar.colorPrimary};
  `,
  branchRowActions: css`
    display: none;
    flex: none;
    gap: 2px;
    align-items: center;
  `,
  branchRowAction: css`
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
  branchRowActionDanger: css`
    &:hover {
      color: ${cssVar.colorError};
      background: ${cssVar.colorErrorBg};
    }
  `,
  branchItemMeta: css`
    margin-top: 1px;
    font-size: 11px;
    color: ${cssVar.colorTextTertiary};
  `,
  branchCreateRow: css`
    cursor: pointer;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 12px;
    border-top: 1px solid ${cssVar.colorSplit};
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  refreshButton: css`
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
      background: ${cssVar.colorFillTertiary};
    }
  `,
  spin: css`
    animation: workspace-controls-spin 0.8s linear infinite;

    @keyframes workspace-controls-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  gitBranchLabel: css`
    overflow: hidden;
    max-width: 160px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  diffStat: css`
    display: inline-flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;
    font-variant-numeric: tabular-nums;
  `,
  diffAdded: css`color: ${cssVar.colorSuccess};`,
  diffModified: css`color: ${cssVar.colorWarning};`,
  diffDeleted: css`color: ${cssVar.colorError};`,
  aheadStat: css`color: ${cssVar.colorInfo};`,
  behindStat: css`color: ${cssVar.colorError};`,
  syncTrigger: css`
    cursor: pointer;
    display: inline-flex;
    flex: none;
    gap: 2px;
    align-items: center;
    padding-block: 2px;
    padding-inline: 4px;
    border-radius: 4px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: background 0.2s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  repoItem: css`
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 8px;
    border-radius: ${cssVar.borderRadius};
    transition: background 0.15s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  repoUrl: css`
    font-size: 11px;
    color: ${cssVar.colorTextDescription};
  `,
  chipDisabled: css`
    cursor: not-allowed;
    opacity: 0.5;
  `,
}));
