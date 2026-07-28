import { isAgentConsoleApiMode } from './registry';
import * as apiToolResolve from './api/portalToolResolve';
import * as mockToolResolve from './toolPortalMocks';

export { normalizeToolPluginId } from '../domain/utils/toolPortal';

function toolResolve() {
  return isAgentConsoleApiMode() ? apiToolResolve : mockToolResolve;
}

export function resolveCrawlMultiState(
  ...args: Parameters<typeof mockToolResolve.resolveCrawlMultiState>
) {
  return toolResolve().resolveCrawlMultiState(...args);
}

export function resolveCrawlResult(
  ...args: Parameters<typeof mockToolResolve.resolveCrawlResult>
) {
  return toolResolve().resolveCrawlResult(...args);
}

export function resolveSearchState(
  ...args: Parameters<typeof mockToolResolve.resolveSearchState>
) {
  return toolResolve().resolveSearchState(...args);
}

export function resolveVerifyPlanState(
  ...args: Parameters<typeof mockToolResolve.resolveVerifyPlanState>
) {
  return toolResolve().resolveVerifyPlanState(...args);
}
