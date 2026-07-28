import { createStaticStyles, cssVar } from 'antd-style';

export const reviewStyles = createStaticStyles(({ css }) => ({
  subheader: css`
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding-block: 4px 8px;
    padding-inline: 8px;
  `,
  scopeChip: css`
    cursor: pointer;
    user-select: none;
    display: inline-flex;
    flex-shrink: 0;
    gap: 6px;
    align-items: center;
    padding-block: 2px;
    padding-inline: 6px;
    border-radius: 4px;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    transition: background 0.15s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  compareChip: css`
    overflow: hidden;
    display: inline-flex;
    flex: 0 1 auto;
    gap: 6px;
    align-items: center;
    min-width: 0;
  `,
  basePicker: css`
    cursor: pointer;
    user-select: none;
    overflow: hidden;
    display: inline-flex;
    flex: 0 1 auto;
    gap: 4px;
    align-items: center;
    min-width: 0;
    padding-block: 1px;
    padding-inline: 6px;
    border-radius: 4px;
    transition: background 0.15s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  refName: css`
    overflow: hidden;
    flex: 0 1 auto;
    min-width: 0;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  headRefText: css`
    overflow: hidden;
    flex: 0 1 auto;
    min-width: 0;
    padding-inline-end: 4px;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  arrow: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextTertiary};
  `,
  totalStats: css`
    display: inline-flex;
    flex-shrink: 0;
    gap: 6px;
    align-items: center;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  `,
  totalAdditions: css`
    color: ${cssVar.colorSuccess};
  `,
  totalDeletions: css`
    color: ${cssVar.colorError};
  `,
  list: css`
    position: relative;
    margin-inline: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
    overflow: hidden;

    & > :first-child {
      border-block-start: none;
    }
  `,
  fileRowItem: css`
    content-visibility: auto;
    contain-intrinsic-size: auto 32px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  fileRow: css`
    cursor: pointer;
    user-select: none;
    display: flex;
    gap: 6px;
    align-items: center;
    width: 100%;
    padding-block: 5px;
    padding-inline: 10px;
    transition: background 0.12s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }
  `,
  chevron: css`
    flex: none;
    color: ${cssVar.colorTextTertiary};
    transition: transform 0.2s;

    &[data-expanded='true'] {
      transform: rotate(90deg);
    }
  `,
  fileHeader: css`
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-width: 0;
    font-size: 12px;
  `,
  pathWrapper: css`
    overflow: hidden;
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
  `,
  dir: css`
    direction: rtl;
    overflow: hidden;
    flex: 0 1 auto;
    min-width: 0;
    color: ${cssVar.colorTextTertiary};
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  fileName: css`
    flex: none;
    color: ${cssVar.colorText};
    white-space: nowrap;
  `,
  stats: css`
    flex: none;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  `,
  additions: css`
    color: ${cssVar.colorSuccess};
  `,
  deletions: css`
    color: ${cssVar.colorError};
  `,
  rowActions: css`
    pointer-events: none;
    position: absolute;
    inset-block: 0;
    inset-inline-end: -8px;
    display: flex;
    align-items: center;
    padding-inline: 28px 0;
    opacity: 0;
    background:
      linear-gradient(to right, transparent 0, ${cssVar.colorFillTertiary} 28px),
      linear-gradient(to right, transparent 0, ${cssVar.colorBgElevated} 28px);
    transition: opacity 0.15s;

    [data-review-row]:hover & {
      pointer-events: auto;
      opacity: 1;
    }
  `,
}));

function splitPath(filePath: string): { dir: string; name: string } {
  const idx = filePath.lastIndexOf('/');
  if (idx < 0) return { dir: '', name: filePath };
  return { dir: `${filePath.slice(0, idx + 1)}`, name: filePath.slice(idx + 1) };
}

export function formatReviewPath(filePath: string): { dir: string; name: string } {
  return splitPath(filePath);
}
