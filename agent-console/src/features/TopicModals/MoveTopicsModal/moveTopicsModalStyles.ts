import { createStaticStyles, cssVar } from 'antd-style';

export const moveTopicsModalStyles = createStaticStyles(({ css }) => ({
  searchInput: css`
    width: 100%;
    padding-block: 6px;
    padding-inline: 10px;
    border: none;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    font-family: inherit;
    font-size: 13px;
    color: ${cssVar.colorText};
    background: transparent;
    outline: none;

    &::placeholder {
      color: ${cssVar.colorTextPlaceholder};
    }
  `,
}));
