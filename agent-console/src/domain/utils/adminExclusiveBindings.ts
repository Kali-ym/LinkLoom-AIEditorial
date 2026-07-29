import type { AgentPlusState } from '../types/agentChatConfig';
import type { CatalogTool } from '../types/skill';
import {
  ADMIN_DISPATCH_TOOL_ID_SET,
  ADMIN_EXCLUSIVE_TOOL_ID_SET,
  ADMIN_LLM_FACING_TOOL_ID_SET,
  isAdminDispatchTool,
  isAdminExclusiveTool,
  isSuperAdminAgent,
} from '../constants/adminExclusiveTools';

/**
 * Strip or force-enable admin tools based on active agent.
 * - Non-super_admin: remove all admin-exclusive tools
 * - super_admin: force LLM-facing (platform + SOP) on; strip dispatch-only CRUD
 */
export function applyAdminExclusiveBindings(
  agentId: string,
  plusState: AgentPlusState,
): AgentPlusState {
  if (!isSuperAdminAgent(agentId)) {
    const plugins = { ...plusState.plugins };
    for (const toolId of ADMIN_EXCLUSIVE_TOOL_ID_SET) {
      delete plugins[toolId];
    }
    return { ...plusState, plugins };
  }

  const plugins = { ...plusState.plugins };
  for (const toolId of ADMIN_DISPATCH_TOOL_ID_SET) {
    delete plugins[toolId];
  }
  for (const toolId of ADMIN_LLM_FACING_TOOL_ID_SET) {
    plugins[toolId] = true;
  }
  return { ...plusState, plugins };
}

export function canToggleAdminExclusiveTool(agentId: string, toolId: string): boolean {
  if (!isAdminExclusiveTool(toolId)) return true;
  // LLM-facing tools are force-enabled for super_admin; dispatch tools are hidden.
  return !isSuperAdminAgent(agentId);
}

export function filterCatalogToolsForAgent(
  agentId: string,
  tools: readonly CatalogTool[],
): CatalogTool[] {
  if (isSuperAdminAgent(agentId)) {
    // Hide dispatch-only CRUD; keep platform + SOP + public tools.
    return tools.filter((tool) => !isAdminDispatchTool(tool.id));
  }
  return tools.filter((tool) => !isAdminExclusiveTool(tool.id));
}
