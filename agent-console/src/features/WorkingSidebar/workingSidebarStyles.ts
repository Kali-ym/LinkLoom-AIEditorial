import { createStaticStyles } from 'antd-style';

import { hideScrollbar, proseWrap } from '../../styles/scrollMixins';

/** §C.5 WorkingSidebar*/
export const workingSidebarStyles = createStaticStyles(({ css, cssVar }) => ({
  header: css`
    flex-shrink: 0;
    background: ${cssVar.colorBgContainer};
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};

    @media (max-width: 767px) {
      padding-inline: max(4px, env(safe-area-inset-left, 0px))
        max(4px, env(safe-area-inset-right, 0px));
    }
  `,
  body: css`
    overflow: hidden;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    background: ${cssVar.colorBgLayout};
    ${proseWrap}
  `,
  pane: css`
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    ${hideScrollbar}
    ${proseWrap}
  `,
  paneHidden: css`
    display: none;
  `,
  paneScroll: css`
    flex-shrink: 0;
    min-width: 0;
    padding: 4px 8px 12px;
    ${proseWrap}
  `,
  resourcesPane: css`
    gap: 12px;
    padding: 0 0 8px;
  `,
  resourceContent: css`
    overflow: hidden;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 0 8px 8px;
  `,
  tabs: css`
    display: flex;
    gap: 4px;
    align-items: center;

    @media (max-width: 767px) {
      overflow-x: auto;
      flex: 1;
      min-width: 0;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  `,
  tab: css`
    cursor: pointer;
    flex-shrink: 0;

    padding-block: 4px;
    padding-inline: 10px;
    border: none;
    border-radius: 6px;

    font-size: 13px;
    color: ${cssVar.colorTextTertiary};

    background: transparent;

    transition:
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    @media (max-width: 767px) {
      min-height: 44px;
      padding-inline: 12px;
    }

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  tabActive: css`
    font-weight: 500;
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillSecondary};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  pills: css`
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    padding: 0 8px;
  `,
  pill: css`
    cursor: pointer;
    user-select: none;

    padding-block: 4px;
    padding-inline: 12px;
    border: none;
    border-radius: 999px;

    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextSecondary};

    background: transparent;

    transition:
      background ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut},
      color ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut};

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillTertiary};
    }
  `,
  pillActive: css`
    font-weight: 500;
    color: ${cssVar.colorText};
    background: ${cssVar.colorFillSecondary};
    box-shadow: inset 0 0 0 1px ${cssVar.colorBorderSecondary};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
}));
