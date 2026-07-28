import {
  isAdminExclusiveTool,
  isSuperAdminAgent,
} from '../../../../domain/constants/adminExclusiveTools';
import { MCP_PLUGIN_PREFIX } from '../../../../domain/utils/agentPluginBindings';
import {
  buildToolCategoryMap,
  TOOL_CATEGORIES,
  type ToolCategory,
  type ToolCategoryColor,
} from '../../../../domain/types/skill';
import type { SkillCatalog } from '../../../../domain/types/skill';

export type AgentBindingKind = 'tool' | 'skill' | 'mcp';

export interface AgentBindingRow {
  id: string;
  name: string;
  description: string;
  kind: AgentBindingKind;
  pinned: boolean;
  /** Category id for tools; undefined for skills/MCP */
  categoryId?: string;
  categoryLabel?: string;
  categoryColor?: ToolCategoryColor;
  categoryIcon?: string;
  /** Admin toolset — only visible to super_admin. */
  adminExclusive?: boolean;
  /** Always enabled for super_admin; toggle disabled in UI. */
  forcedEnabled?: boolean;
}

export interface ToolGroup {
  id: string;
  label: string;
  icon: string;
  color: ToolCategoryColor;
  items: AgentBindingRow[];
}

export function isAgentCallableToolScope(scope?: string): boolean {
  return !scope || scope === 'agent' || scope === 'both';
}

export function classifyBindingKind(id: string, catalog: SkillCatalog): AgentBindingKind {
  if (id.startsWith(MCP_PLUGIN_PREFIX)) return 'mcp';
  const skillIds = new Set([
    ...catalog.agentSkills.map((skill) => skill.id),
    ...catalog.projectSkills.map((skill) => skill.id),
    ...catalog.userSkills.map((skill) => skill.id),
  ]);
  if (skillIds.has(id)) return 'skill';
  return 'tool';
}

export function buildAgentBindingRows(
  catalog: SkillCatalog,
  pinnedPlugins: Record<string, boolean>,
  agentId?: string,
): AgentBindingRow[] {
  const superAdmin = isSuperAdminAgent(agentId ?? '');
  const rows: AgentBindingRow[] = [];
  const seenSkills = new Set<string>();
  const categoryMap = buildToolCategoryMap();
  const categoryIndex = new Map<string, ToolCategory>(
    TOOL_CATEGORIES.map((c) => [c.id, c]),
  );

  const pushSkill = (id: string, name: string, description: string) => {
    if (seenSkills.has(id)) return;
    seenSkills.add(id);
    rows.push({
      id,
      name,
      description,
      kind: 'skill',
      pinned: Boolean(pinnedPlugins[id]),
    });
  };

  for (const skill of catalog.agentSkills) {
    if (!skill.id) continue;
    pushSkill(skill.id, skill.name, skill.description);
  }

  for (const tool of catalog.tools) {
    if (!tool.id) continue;
    const adminExclusive = isAdminExclusiveTool(tool.id);
    if (adminExclusive && !superAdmin) continue;
    const catId = tool.category ?? categoryMap.get(tool.id);
    const cat = catId ? categoryIndex.get(catId) : undefined;
    if (tool.id.startsWith(MCP_PLUGIN_PREFIX)) {
      rows.push({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        kind: 'mcp',
        pinned: false,
      });
      continue;
    }
    rows.push({
      id: tool.id,
      name: tool.id,
      description: tool.description,
      kind: 'tool',
      pinned: false,
      categoryId: catId,
      categoryLabel: cat?.label,
      categoryColor: cat?.color,
      categoryIcon: cat?.icon,
      adminExclusive,
      forcedEnabled: adminExclusive && superAdmin,
    });
  }

  return rows;
}

export function groupAgentBindingRows(rows: AgentBindingRow[]): {
  tools: ToolGroup[];
  skills: AgentBindingRow[];
  mcp: AgentBindingRow[];
} {
  const toolRows = rows.filter((row) => row.kind === 'tool');

  // Group tools by category
  const catMap = new Map<string, ToolGroup>();
  for (const tool of toolRows) {
    const catId = tool.categoryId ?? '__other__';
    if (!catMap.has(catId)) {
      catMap.set(catId, {
        id: catId,
        label: tool.categoryLabel ?? '未分类',
        icon: tool.categoryIcon ?? 'extension',
        color: tool.categoryColor ?? 'slate',
        items: [],
      });
    }
    catMap.get(catId)!.items.push(tool);
  }

  // Maintain category order from TOOL_CATEGORIES
  const orderedToolGroups: ToolGroup[] = [];
  for (const cat of TOOL_CATEGORIES) {
    const group = catMap.get(cat.id);
    if (group) {
      orderedToolGroups.push(group);
      catMap.delete(cat.id);
    }
  }
  // Remaining uncategorized tools
  for (const [, group] of catMap) {
    orderedToolGroups.push(group);
  }

  return {
    tools: orderedToolGroups,
    skills: rows.filter((row) => row.kind === 'skill'),
    mcp: rows.filter((row) => row.kind === 'mcp'),
  };
}

export function countEnabledBindings(
  rows: AgentBindingRow[],
  plugins: Record<string, boolean>,
): number {
  return rows.filter((row) => row.forcedEnabled || plugins[row.id]).length;
}
