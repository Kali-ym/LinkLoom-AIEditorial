import type { SkillCatalog } from '../types/skill';

export const MCP_PLUGIN_PREFIX = 'mcp:';

export function toMcpPluginId(mcpServerId: string): string {
  return `${MCP_PLUGIN_PREFIX}${mcpServerId}`;
}

export function parseMcpPluginId(pluginId: string): string | null {
  return pluginId.startsWith(MCP_PLUGIN_PREFIX)
    ? pluginId.slice(MCP_PLUGIN_PREFIX.length)
    : null;
}

export function isAgentBindingEnabled(
  plugins: Record<string, boolean>,
  id: string,
): boolean {
  return Boolean(plugins[id]);
}

export function filterBindingsByPlugins<T extends { id: string }>(
  items: readonly T[],
  plugins: Record<string, boolean>,
): T[] {
  return items.filter((item) => isAgentBindingEnabled(plugins, item.id));
}

export function deriveAgentBindingIds(
  plugins: Record<string, boolean>,
  catalog: SkillCatalog,
): { toolIds: string[]; skillIds: string[]; mcpServerIds: string[] } {
  const skillIdSet = new Set([
    ...catalog.agentSkills.map((skill) => skill.id),
    ...catalog.projectSkills.map((skill) => skill.id),
    ...catalog.userSkills.map((skill) => skill.id),
  ]);
  const toolIdSet = new Set(
    catalog.tools
      .map((tool) => tool.id)
      .filter((id) => !id.startsWith(MCP_PLUGIN_PREFIX)),
  );

  const toolIds: string[] = [];
  const skillIds: string[] = [];
  const mcpServerIds: string[] = [];

  for (const [pluginId, enabled] of Object.entries(plugins)) {
    if (!enabled) continue;

    const mcpId = parseMcpPluginId(pluginId);
    if (mcpId) {
      mcpServerIds.push(mcpId);
      continue;
    }

    if (skillIdSet.has(pluginId)) {
      skillIds.push(pluginId);
      continue;
    }

    if (toolIdSet.has(pluginId)) {
      toolIds.push(pluginId);
      continue;
    }

    toolIds.push(pluginId);
  }

  return {
    toolIds: [...new Set(toolIds)],
    skillIds: [...new Set(skillIds)],
    mcpServerIds: [...new Set(mcpServerIds)],
  };
}
