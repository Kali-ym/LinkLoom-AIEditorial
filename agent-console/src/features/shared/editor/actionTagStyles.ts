import { createStaticStyles } from 'antd-style';

/** Inline tag trailing margin — kept local to avoid ChatInput coupling. */
const TAG_MARGIN_INLINE_END = 4;

const colored = (color: string, borderRadius: string) => `
  color: ${color};

  &.selected {
    border-radius: ${borderRadius};
    outline: 2px solid ${color};
    outline-offset: 1px;
  }
`;

/** §C.4 ActionTag*/
export const actionTagStyles = createStaticStyles(({ css, cssVar }) => ({
  actionTag: css`
    cursor: default;
    user-select: none;

    display: inline-flex;
    gap: 4px;
    align-items: center;

    margin-inline-end: ${TAG_MARGIN_INLINE_END}px;
    padding-inline: 2px;

    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    vertical-align: -3px;
  `,
  actionTagIcon: css`
    display: inline-grid;
    place-items: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;

    svg {
      width: 14px;
      height: 14px;
    }
  `,
  skillTag: css`
    ${colored(cssVar.colorSuccess, cssVar.borderRadius)}
  `,
  agentSkillTag: css`
    ${colored(cssVar.colorSuccess, cssVar.borderRadius)}
  `,
  projectSkillTag: css`
    ${colored(cssVar.colorSuccess, cssVar.borderRadius)}
  `,
  toolTag: css`
    ${colored(cssVar.colorInfo, cssVar.borderRadius)}
  `,
  commandTag: css`
    ${colored(cssVar.purple, cssVar.borderRadius)}
  `,
  fileTag: css`
    ${colored(cssVar.colorInfo, cssVar.borderRadius)}
  `,
}));
