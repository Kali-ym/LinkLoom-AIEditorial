import { Flexbox, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';

import { SubRouteRightPanel } from '../../components/SubRouteRightPanel';
import { systemStatusSelectors } from '../../selectors/systemStatus';
import { useLayoutStore } from '../../stores';
import { taskDetailPageStrings } from './taskDetailPageStrings';

/** §C.54 / §C.55*/
export const TaskAgentPanel = memo(function TaskAgentPanel() {
  const expand = useLayoutStore(systemStatusSelectors.showTaskAgentPanel);
  const toggle = useLayoutStore((s) => s.toggleTaskAgentPanel);

  return (
    <SubRouteRightPanel
      dataRegion="task-agent-panel"
      expand={expand}
      id="taskAgentPanel"
      title={taskDetailPageStrings.taskAgentTitle}
      onExpandChange={toggle}
    >
      <Flexbox flex={1} gap={12} padding={16} style={{ overflowY: 'auto' }}>
        <Text fontSize={13} type="secondary">
          {taskDetailPageStrings.taskAgentHint}
        </Text>
        <Flexbox
          gap={8}
          padding={12}
          style={{
            border: `1px solid ${cssVar.colorBorderSecondary}`,
            borderRadius: cssVar.borderRadiusLG,
            background: cssVar.colorFillQuaternary,
          }}
        >
          <Text fontSize={12} type="secondary">
            {taskDetailPageStrings.taskAgentMockUser}
          </Text>
        </Flexbox>
        <Flexbox
          gap={8}
          padding={12}
          style={{
            border: `1px solid ${cssVar.colorBorderSecondary}`,
            borderRadius: cssVar.borderRadiusLG,
          }}
        >
          <Text fontSize={13}>{taskDetailPageStrings.taskAgentMockReply}</Text>
        </Flexbox>
      </Flexbox>
    </SubRouteRightPanel>
  );
});
