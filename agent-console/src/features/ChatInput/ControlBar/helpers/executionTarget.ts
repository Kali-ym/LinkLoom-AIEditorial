import type { AgencyConfig, DeviceExecutionTarget } from '../../../../domain/types/workspaceControls';
import { IS_ADMIN_DESKTOP } from './platform';

export function resolveExecutionTarget(
  agencyConfig: AgencyConfig | undefined,
  options?: { isDesktop?: boolean },
): DeviceExecutionTarget {
  const isDesktop = options?.isDesktop ?? IS_ADMIN_DESKTOP;
  const stored = agencyConfig?.executionTarget;
  const effective: DeviceExecutionTarget = stored ?? (isDesktop ? 'local' : 'none');
  return effective;
}

export function executionTargetToRuntimeMode(
  target: DeviceExecutionTarget,
): 'local' | 'cloud' | 'none' {
  switch (target) {
    case 'local':
      return 'local';
    case 'sandbox':
      return 'cloud';
    default:
      return 'none';
  }
}
