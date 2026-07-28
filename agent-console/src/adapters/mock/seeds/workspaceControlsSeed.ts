import {
  MOCK_CLOUD_REPOS,
  MOCK_GIT_BRANCHES,
  MOCK_RECENT_DIRS,
  MOCK_WORKSPACE_DEVICES,
  createDefaultGitStatus,
} from '../../workspaceControlsMocks';

export function getMockWorkspaceControlsSeed() {
  return {
    devices: MOCK_WORKSPACE_DEVICES,
    recentDirs: MOCK_RECENT_DIRS,
    branches: MOCK_GIT_BRANCHES,
    cloudRepos: MOCK_CLOUD_REPOS,
    gitStatus: createDefaultGitStatus(),
  };
}
