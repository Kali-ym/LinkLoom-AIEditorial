import { createStaticStyles } from 'antd-style';

export const headerStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    position: relative;
    z-index: 20;
    flex-shrink: 0;
    container-name: agent-conv-header;
    container-type: inline-size;
    background: ${cssVar.colorBgContainer};
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
  leftContent: css`
    overflow: hidden;
    flex: 1 1 auto;
    min-width: 0;
  `,
  slotLeft: css`
    overflow: hidden;
    flex: 1 1 auto;
    min-width: 0;
  `,
  slotRight: css`
    flex: 0 0 auto;
    min-width: 0;
  `,
  tagTitle: css`
    overflow: hidden;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));
