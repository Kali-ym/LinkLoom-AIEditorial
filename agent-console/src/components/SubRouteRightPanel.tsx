import { DraggablePanel, Flexbox, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, type ReactNode } from 'react';

import {
  WORKING_SIDEBAR_DEFAULT_WIDTH,
  WORKING_SIDEBAR_MAX_WIDTH,
  WORKING_SIDEBAR_MIN_WIDTH,
} from '../constants/layoutTokens';
import { panelStyles } from '../layout/panelStyles';
import { useLayoutStore } from '../stores';

interface SubRouteRightPanelProps {
  children: ReactNode;
  dataRegion: string;
  expand: boolean;
  id: string;
  onExpandChange: (expand: boolean) => void;
  title: string;
}

/** §C.54 / §C.55*/
export const SubRouteRightPanel = memo(function SubRouteRightPanel({
  children,
  dataRegion,
  expand,
  id,
  onExpandChange,
  title,
}: SubRouteRightPanelProps) {
  const zenMode = useLayoutStore((s) => s.zenMode);

  if (zenMode) return null;

  return (
    <DraggablePanel
      backgroundColor={cssVar.colorBgContainer}
      className={panelStyles.rightPanel}
      classNames={{ content: panelStyles.rightPanelContent }}
      data-region={dataRegion}
      defaultSize={{ width: WORKING_SIDEBAR_DEFAULT_WIDTH }}
      expand={expand}
      expandable={false}
      id={id}
      maxWidth={WORKING_SIDEBAR_MAX_WIDTH}
      minWidth={WORKING_SIDEBAR_MIN_WIDTH}
      pin
      placement="right"
      showHandleWhenCollapsed={false}
      size={{ height: '100%', width: WORKING_SIDEBAR_DEFAULT_WIDTH }}
      stableLayout
      onExpandChange={onExpandChange}
    >
      <Flexbox height="100%" style={{ minHeight: 0 }}>
        <Flexbox
          horizontal
          align="center"
          height={44}
          paddingInline={12}
          style={{ borderBottom: `1px solid ${cssVar.colorBorderSecondary}`, flexShrink: 0 }}
        >
          <Text ellipsis fontSize={13} weight={600}>
            {title}
          </Text>
        </Flexbox>
        <Flexbox flex={1} style={{ minHeight: 0, overflow: 'hidden' }}>
          {children}
        </Flexbox>
      </Flexbox>
    </DraggablePanel>
  );
});
