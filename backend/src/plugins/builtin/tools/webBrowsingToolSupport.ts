import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import type { WebBrowsingService } from '../../../services/web/WebBrowsingService.js';

export function requireWebBrowsingService(
  context: ToolExecutionContext,
  toolId: string,
): WebBrowsingService {
  const service = context.services.webBrowsingService;
  if (!service) {
    throw new Error(`WebBrowsingService is not available for tool "${toolId}"`);
  }
  return service;
}
