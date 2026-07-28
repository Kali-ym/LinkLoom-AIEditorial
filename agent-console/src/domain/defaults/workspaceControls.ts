import type { AgencyConfig, GitRepoStatus } from '../types/workspaceControls';

export function createDefaultAgencyConfig(): AgencyConfig {
  return {
    executionTarget: 'local',
    boundDeviceId: undefined,
    workingDirByDevice: {},
  };
}

/** Stable readonly default — do not call `createDefaultAgencyConfig()` inside selectors. */
export const DEFAULT_AGENCY_CONFIG: AgencyConfig = createDefaultAgencyConfig();

export function createDefaultGitStatus(dirtyCount = 2): GitRepoStatus {
  return {
    branch: 'main',
    clean: dirtyCount === 0,
    ahead: 1,
    behind: 0,
    hasUpstream: true,
    added: 1,
    modified: dirtyCount,
    deleted: 0,
    pullRequest: { number: 42, url: 'https://github.com/example/linkloom/pull/42' },
  };
}
