import { createStaticStyles } from 'antd-style';

import { NAV_HEADER_HEIGHT } from '../../constants/layoutTokens';

/** §C.21 Portal chrome — shared header / shell tokens */
export const portalChromeStyles = createStaticStyles(({ css, cssVar }) => ({
  headerShell: css`
    flex-shrink: 0;
    min-height: ${NAV_HEADER_HEIGHT}px;
    background: ${cssVar.colorBgContainer};
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
  bodyCanvas: css`
    flex: 1;
    min-height: 0;
    background: ${cssVar.colorBgLayout};
  `,
}));
