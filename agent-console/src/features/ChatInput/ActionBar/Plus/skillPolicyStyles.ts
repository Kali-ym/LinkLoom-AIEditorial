import { createStaticStyles, cssVar } from 'antd-style';

export const skillPolicyStyles = createStaticStyles(({ css }) => ({
  check: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: ${cssVar.colorText};
  `,
  deleteButton: css`
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    padding-block: 8px;
    padding-inline: 10px;
    border: 0;
    border-radius: 6px;
    font-size: 13px;
    color: ${cssVar.colorError};
    background: transparent;

    &:hover:not(:disabled) {
      background: ${cssVar.colorErrorBg};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  `,
  deleteDivider: css`
    height: 1px;
    margin-block: 4px;
    margin-inline: 8px;
    background: ${cssVar.colorBorderSecondary};
  `,
  iconAuto: css`
    color: ${cssVar.colorInfo};
  `,
  iconDefault: css`
    color: ${cssVar.colorTextSecondary};
  `,
  iconPinned: css`
    color: ${cssVar.colorInfo};
  `,
  policyButton: css`
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border: 0;
    border-radius: 4px;
    color: ${cssVar.colorTextSecondary};
    background: transparent;

    &:hover:not(:disabled) {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  `,
  policyItem: css`
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    padding-block: 8px;
    padding-inline: 10px;
    border: 0;
    border-radius: 6px;
    font-size: 13px;
    color: ${cssVar.colorText};
    background: transparent;

    &:hover:not(:disabled) {
      background: ${cssVar.colorFillTertiary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  `,
  policyItemIcon: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 18px;
  `,
  policyPanel: css`
    min-width: 160px;
    padding-block: 4px;
    border-radius: 8px;
    background: ${cssVar.colorBgElevated};
    box-shadow:
      0 0 15px #00000008,
      0 2px 30px #00000014;
  `,
  policyText: css`
    flex: 1;
    text-align: start;
  `,
}));
