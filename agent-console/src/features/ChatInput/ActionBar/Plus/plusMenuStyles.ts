import { createStaticStyles, cssVar } from 'antd-style';

export const plusMenuStyles = createStaticStyles(({ css }) => ({
  activeLabel: css`
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    color: inherit;

    span {
      overflow: hidden;
      min-width: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  labelWithChip: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;
  `,
  countChip: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding-block: 0;
    padding-inline: 6px;
    border-radius: 9px;
    font-size: 11px;
    line-height: 18px;
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillSecondary};
  `,
  adminBuiltinBadge: css`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    height: 20px;
    padding-block: 0;
    padding-inline: 8px;
    border-radius: 10px;
    border: 1px solid rgba(245, 158, 11, 0.45);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    color: #b45309;
    background: rgba(251, 191, 36, 0.22);
  `,
  searchOptionRow: css`
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    min-width: 220px;
    max-width: 320px;

    .title {
      line-height: 1.25;
    }

    .desc {
      margin-block-start: 3px;
      font-size: 12px;
      line-height: 1.35;
      color: ${cssVar.colorTextDescription};
      white-space: normal;
    }
  `,
  searchIconBox: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  uploadLabel: css`
    cursor: pointer;
    display: block;
    width: 100%;
  `,
  viewMoreFooter: css`
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-height: 32px;
    padding-inline: 4px;
    border: 0;
    border-radius: 6px;
    font-size: 14px;
    color: ${cssVar.colorText};
    background: transparent;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  skillSearch: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    margin-block-end: 4px;

    input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      font-size: 12px;
      color: ${cssVar.colorText};
      outline: none;
    }

    input::placeholder {
      color: ${cssVar.colorTextDescription};
    }
  `,
  groupHeader: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-block: 2px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
}));
