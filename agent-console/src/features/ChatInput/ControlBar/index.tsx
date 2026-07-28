import { Flexbox, Skeleton } from '@lobehub/ui';
import { memo } from 'react';

import type { ChatInputActionKey } from '../ActionBar/config';
import { useAgentStore } from '../../../stores';
import { ApprovalMode } from './ApprovalMode';
import { controlBarStyles } from './controlBarStyles';
import { ContextWindow } from './ContextWindow';
import { ModeSelector } from './ModeSelector';
import { WorkspaceControls } from './WorkspaceControls';

/** §C.30 / §C.38*/
export const ControlBar = memo(function ControlBar({
  isConfigLoading = false,
  rightActions = [],
}: {
  isConfigLoading?: boolean;
  rightActions?: ChatInputActionKey[];
}) {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const enableAgentMode = useAgentStore((s) => s.getEnableAgentMode());
  const showContextWindow = rightActions.includes('contextWindow');

  if (isConfigLoading) {
    return (
      <Flexbox horizontal align="center" className={controlBarStyles.bar} gap={4}>
        <Skeleton.Button active size="small" style={{ height: 22, minWidth: 64, width: 64 }} />
        <Skeleton.Button active size="small" style={{ height: 22, minWidth: 100, width: 100 }} />
      </Flexbox>
    );
  }

  return (
    <Flexbox
      horizontal
      align="center"
      className={controlBarStyles.bar}
      id="controlBar"
      justify="space-between"
    >
      <Flexbox horizontal align="center" className={controlBarStyles.leftGroup}>
        <ModeSelector />
        {enableAgentMode ? <WorkspaceControls agentId={activeAgentId} /> : null}
      </Flexbox>

      <Flexbox horizontal align="center" className={controlBarStyles.rightGroup}>
        {enableAgentMode ? <ApprovalMode /> : null}
        {showContextWindow ? <ContextWindow /> : null}
      </Flexbox>
    </Flexbox>
  );
});
