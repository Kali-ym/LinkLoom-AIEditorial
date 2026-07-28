import { createStaticStyles } from 'antd-style';

/** §C — dev/demo 折叠面板与演示网格（自 index-html.css 迁出） */
export const showcaseStyles = createStaticStyles(({ css, cssVar }) => ({
  panel: css`
    border: 1px dashed ${cssVar.colorBorder};
    border-radius: 10px;
    padding: 0 12px;
    margin-bottom: 8px;

    @media (max-width: 767px) {
      display: none;
    }
  `,
  accordionLabel: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  msgTypesGrid: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 12px;
  `,
  toolDemoGrid: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 0 8px 8px;
  `,
  reasoningDemoGrid: css`
    display: grid;
    gap: 12px;
    padding: 4px 0 8px 8px;
  `,
  groundingDemoGrid: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  skillTagDemoRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 4px 0 8px;
  `,
}));
