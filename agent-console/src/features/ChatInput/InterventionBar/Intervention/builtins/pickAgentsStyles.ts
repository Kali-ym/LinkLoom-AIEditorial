import { createStaticStyles, keyframes } from 'antd-style';

import { hideScrollbar, proseWrap } from '../../../../../styles/scrollMixins';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

/** Ported from upstream `PickAgents/style.ts` */
export const pickAgentsStyles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border: 1px solid ${cssVar.colorFillSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorBgElevated};
    transition:
      border-color ${cssVar.motionDurationMid},
      background ${cssVar.motionDurationMid};

    &:hover {
      border-color: ${cssVar.colorPrimaryHover};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }
  `,
  cardDescription: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    font-size: 12px;
    line-height: 1.6;
    color: ${cssVar.colorTextSecondary};
  `,
  cardHeader: css`
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  `,
  cardSelected: css`
    border-color: ${cssVar.colorPrimary};
    background: ${cssVar.colorPrimaryBg};

    &:hover {
      border-color: ${cssVar.colorPrimary};
    }
  `,
  cardTitle: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  categoryItem: css`
    cursor: pointer;
    flex: none;
    padding-block: 6px;
    padding-inline: 12px;
    border: none;
    border-radius: ${cssVar.borderRadius};
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;
    background: transparent;
    transition:
      background ${cssVar.motionDurationMid},
      color ${cssVar.motionDurationMid};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  categoryItemActive: css`
    font-weight: 500;
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillSecondary};
  `,
  container: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  `,
  content: css`
    min-width: 0;
    max-width: 100%;
    ${proseWrap}
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    align-content: start;
  `,
  header: css`
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 8px;
  `,
  root: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  `,
  tabBar: css`
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
    flex-flow: row nowrap;
    gap: 6px;
    padding-block-end: 8px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    ${hideScrollbar}
  `,
  empty: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  skeletonLine: css`
    height: 10px;
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorFillTertiary};
    animation: ${pulse} 1.5s ease-in-out infinite;
  `,
}));
