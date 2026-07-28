import { memo } from 'react';

import { useAgentStore } from '../../../stores';
import { useWorkspaceControlsStore } from '../../../stores/workspaceControlsStore';
import { DEFAULT_AGENCY_CONFIG } from '../../../domain/defaults/workspaceControls';
import { IS_ADMIN_DESKTOP } from './helpers/platform';
import { resolveExecutionTarget } from './helpers/executionTarget';
import { CloudRepoSwitcher } from './Workspace/CloudRepoSwitcher';
import { DeviceSwitcher } from './Workspace/DeviceSwitcher';
import { WorkingDirectorySection } from './Workspace/WorkingDirectorySection';

/** §C.30 / §C.46*/
export const WorkspaceControls = memo(function WorkspaceControls({
  agentId,
  alwaysShowWorkspace = false,
}: {
  agentId: string;
  alwaysShowWorkspace?: boolean;
}) {
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === agentId));
  const agency = useWorkspaceControlsStore(
    (s) => s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG,
  );
  const effectiveTarget = resolveExecutionTarget(agency);
  const isDeviceMode = effectiveTarget === 'device' && Boolean(agency.boundDeviceId);
  const showLocalWorkspace =
    alwaysShowWorkspace ||
    Boolean(agent?.isLocalSystemEnabled) ||
    Boolean(agent?.isDeviceMode);

  const renderWorkspace = () => {
    if (isDeviceMode) return <WorkingDirectorySection agentId={agentId} />;

    if (!IS_ADMIN_DESKTOP) {
      return alwaysShowWorkspace ? <CloudRepoSwitcher agentId={agentId} /> : null;
    }

    if (showLocalWorkspace) {
      return <WorkingDirectorySection agentId={agentId} />;
    }

    return null;
  };

  return (
    <>
      <DeviceSwitcher agentId={agentId} />
      {renderWorkspace()}
    </>
  );
});
