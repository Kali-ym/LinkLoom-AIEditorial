export type DeviceExecutionTarget = 'none' | 'local' | 'sandbox' | 'device';

export interface AgencyConfig {
  executionTarget?: DeviceExecutionTarget;
  boundDeviceId?: string;
  workingDirByDevice?: Record<string, string>;
  /** Web claude-code cloud credential configured (§C.48 guard). */
  cloudCredentialConfigured?: boolean;
}

export interface WorkspaceDevice {
  deviceId: string;
  friendlyName: string;
  online: boolean;
  platform?: 'mac' | 'linux' | 'windows';
}

export interface RecentWorkingDir {
  path: string;
  name: string;
}

export interface GitBranchInfo {
  name: string;
  current?: boolean;
  hasUncommitted?: boolean;
}

export interface GitRepoStatus {
  branch: string;
  detached?: boolean;
  clean: boolean;
  ahead?: number;
  behind?: number;
  hasUpstream?: boolean;
  added?: number;
  modified?: number;
  deleted?: number;
  pullRequest?: { number: number; url?: string };
}
