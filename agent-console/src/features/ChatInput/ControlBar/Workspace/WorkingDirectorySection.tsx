import { memo } from 'react';

import { DEFAULT_AGENCY_CONFIG } from '../../../../domain/defaults/workspaceControls';
import { useWorkspaceControlsStore } from '../../../../stores/workspaceControlsStore';
import { resolveExecutionTarget } from '../helpers/executionTarget';
import { useEffectiveWorkingDirectory, useRepoType } from '../hooks/useEffectiveWorkingDirectory';
import { GitStatus } from './GitStatus';
import { WorkingDirectoryPicker } from './WorkingDirectoryPicker';

/** §C.46*/
export const WorkingDirectorySection = memo(function WorkingDirectorySection({
  agentId,
}: {
  agentId: string;
}) {
  const path = useEffectiveWorkingDirectory(agentId);
  const repoType = useRepoType(agentId);
  const agency = useWorkspaceControlsStore(
    (s) => s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG,
  );
  const effectiveTarget = resolveExecutionTarget(agency);
  const deviceId =
    effectiveTarget === 'device' && agency.boundDeviceId ? agency.boundDeviceId : undefined;

  return (
    <>
      <WorkingDirectoryPicker agentId={agentId} />
      {path && repoType ? (
        <GitStatus deviceId={deviceId} path={path} repoType={repoType} />
      ) : null}
    </>
  );
});
