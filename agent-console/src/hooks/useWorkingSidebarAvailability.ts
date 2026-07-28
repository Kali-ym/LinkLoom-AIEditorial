import { useMemo } from 'react';

import { useAgentStore, useTopicStore } from '../stores';
import type { WorkingSidebarTab } from '../stores/types';

export interface WorkingSidebarAvailability {
  workingDirectory: string;
  isLocalSystemEnabled: boolean;
  isDeviceMode: boolean;
  repoType?: 'git' | 'github';
  filesAvailable: boolean;
  reviewAvailable: boolean;
  paramsAvailable: boolean;
}

/** Upstream `WorkingSidebar/index.tsx` — files/review/params tab gating inputs. */
export function useWorkingSidebarAvailability(): WorkingSidebarAvailability {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const agents = useAgentStore((s) => s.agents);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topicWorkingDirectory = useTopicStore(
    (s) => s.topics.find((t) => t.id === activeTopicId)?.workingDirectory,
  );

  return useMemo(() => {
    const agent = agents.find((a) => a.id === activeAgentId);
    const isLocalSystemEnabled = Boolean(agent?.isLocalSystemEnabled);
    const isDeviceMode = Boolean(agent?.isDeviceMode);
    const workingDirectory = topicWorkingDirectory || agent?.workingDirectory || '';
    const repoType = agent?.repoType;
    const filesAvailable = (isLocalSystemEnabled || isDeviceMode) && Boolean(workingDirectory);
    const reviewAvailable = filesAvailable && Boolean(repoType);

    return {
      workingDirectory,
      isLocalSystemEnabled,
      isDeviceMode,
      repoType,
      filesAvailable,
      reviewAvailable,
      paramsAvailable: true,
    };
  }, [activeAgentId, agents, topicWorkingDirectory]);
}

/** Resolve visible tab when stored tab points at unavailable pane*/
export function resolveWorkingSidebarTab(
  storedTab: WorkingSidebarTab,
  availability: WorkingSidebarAvailability,
): WorkingSidebarTab {
  const { filesAvailable, reviewAvailable, paramsAvailable } = availability;

  if (storedTab === 'params' && paramsAvailable) return 'params';
  if (storedTab === 'review' && reviewAvailable) return 'review';
  if (storedTab === 'files' && filesAvailable) return 'files';
  if (storedTab === 'space') return 'space';
  if (reviewAvailable) return 'review';
  if (filesAvailable) return 'files';
  return 'space';
}
