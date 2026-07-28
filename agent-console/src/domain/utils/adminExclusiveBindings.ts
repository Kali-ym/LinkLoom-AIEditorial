import type { AgentPlusState } from '../types/agentChatConfig';
import type { CatalogTool } from '../types/skill';
import {
  ADMIN_EXCLUSIVE_TOOL_ID_SET,
  isAdminExclusiveTool,
  isSuperAdminAgent,
} from '../constants/adminExclusiveTools';

/** Strip or force-enable admin-exclusive tools based on active agent. */
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
  for (const toolId of ADMIN_EXCLUSIVE_TOOL_ID_SET) {
    plugins[toolId] = true;
  }
  return { ...plusState, plugins };
}

export function canToggleAdminExclusiveTool(agentId: string, toolId: string): boolean {
  if (!isAdminExclusiveTool(toolId)) return true;
  return !isSuperAdminAgent(agentId);
}

export function filterCatalogToolsForAgent(
  agentId: string,
  tools: readonly CatalogTool[],
): CatalogTool[] {
  if (isSuperAdminAgent(agentId)) return [...tools];
  return tools.filter((tool) => !isAdminExclusiveTool(tool.id));
}
