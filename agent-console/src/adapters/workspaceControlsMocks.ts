import type { GitBranchInfo, RecentWorkingDir, WorkspaceDevice } from '../domain/types/workspaceControls';
import { WORKING_DIR } from '../fixtures/mockFiles';

export {
  DEFAULT_AGENCY_CONFIG,
  createDefaultAgencyConfig,
  createDefaultGitStatus,
} from '../domain/defaults/workspaceControls';

export const MOCK_WORKSPACE_DEVICES: WorkspaceDevice[] = [
  { deviceId: 'local-mac', friendlyName: 'MacBook Pro', online: true, platform: 'mac' },
  { deviceId: 'dev-linux', friendlyName: 'CI Runner', online: true, platform: 'linux' },
  { deviceId: 'home-pc', friendlyName: 'Home PC', online: false, platform: 'windows' },
];

export const MOCK_RECENT_DIRS: RecentWorkingDir[] = [
  { path: WORKING_DIR, name: 'linkloom' },
  { path: '~/projects/linkloom', name: 'linkloom' },
  { path: '~/sandbox/demo', name: 'demo' },
];

export const MOCK_GIT_BRANCHES: GitBranchInfo[] = [
  { name: 'main', current: true, hasUncommitted: true },
  { name: 'feat/agent-console', hasUncommitted: false },
  { name: 'fix/workspace-controls', hasUncommitted: false },
];

export const MOCK_CLOUD_REPOS = ['linkloom/app', 'linkloom/docs', 'acme/internal-tools'];
