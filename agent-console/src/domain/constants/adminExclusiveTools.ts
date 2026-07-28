import { TOOL_CATEGORIES } from '../types/skill';

export const SUPER_ADMIN_AGENT_ID = 'super_admin';

const ADMIN_CATEGORY_PREFIX = 'admin-';

/** All admin toolset tool ids (derived from TOOL_CATEGORIES admin-* groups). */
export const ADMIN_EXCLUSIVE_TOOL_IDS: readonly string[] = TOOL_CATEGORIES.filter((cat) =>
  cat.id.startsWith(ADMIN_CATEGORY_PREFIX),
).flatMap((cat) => cat.toolIds);

export const ADMIN_EXCLUSIVE_TOOL_ID_SET = new Set(ADMIN_EXCLUSIVE_TOOL_IDS);

export function isAdminExclusiveTool(toolId: string): boolean {
  return ADMIN_EXCLUSIVE_TOOL_ID_SET.has(toolId);
}

export function isSuperAdminAgent(agentId: string): boolean {
  return agentId === SUPER_ADMIN_AGENT_ID;
}

export function isAdminToolCategory(categoryId: string): boolean {
  return categoryId.startsWith(ADMIN_CATEGORY_PREFIX);
}

/** Tool categories shown in global catalogs (excludes super_admin built-ins). */
export function getPublicToolCategories() {
  return TOOL_CATEGORIES.filter((cat) => !isAdminToolCategory(cat.id));
}

export function excludeAdminExclusiveTools<T extends { id: string }>(tools: readonly T[]): T[] {
  return tools.filter((tool) => !isAdminExclusiveTool(tool.id));
}

/** Tools that may appear in global catalogs (Agents 工具页 / 绑定列表). */
export function isPublicCatalogTool(tool: { id?: string | null }): boolean {
  const id = tool.id?.trim();
  if (!id) return false;
  return !isAdminExclusiveTool(id);
}

export function filterPublicCatalogTools<T extends { id?: string | null }>(
  tools: readonly T[],
): T[] {
  return tools.filter(isPublicCatalogTool);
}
