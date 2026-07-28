import { useMemo } from 'react';

import { DEFAULT_AGENCY_CONFIG } from '../../../../domain/defaults/workspaceControls';
import { useAgentStore, useTopicStore } from '../../../../stores';
import { useWorkspaceControlsStore } from '../../../../stores/workspaceControlsStore';
import { useWorkspaceStore } from '../../../../stores/workspaceStore';

/** §C.46*/
export function useEffectiveWorkingDirectory(agentId: string): string {
  const topicWorkingDirectory = useTopicStore((s) => {
    const topicId = s.activeTopicId;
    return s.topics.find((t) => t.id === topicId)?.workingDirectory;
  });
  const agentWorkingDirectory = useAgentStore(
    (s) => s.agents.find((a) => a.id === agentId)?.workingDirectory,
  );
  const workspaceDir = useWorkspaceStore((s) => s.workingDir);
  const agency = useWorkspaceControlsStore(
    (s) => s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG,
  );
  const deviceDir = agency.boundDeviceId
    ? agency.workingDirByDevice?.[agency.boundDeviceId]
    : undefined;

  return useMemo(
    () => topicWorkingDirectory || deviceDir || agentWorkingDirectory || workspaceDir || '',
    [agentWorkingDirectory, deviceDir, topicWorkingDirectory, workspaceDir],
  );
}

export function useRepoType(agentId: string): 'git' | 'github' | undefined {
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === agentId));
  return agent?.repoType;
}
