import { TOOL_CATEGORIES } from '../types/skill';

export const SUPER_ADMIN_AGENT_ID = 'super_admin';

const ADMIN_CATEGORY_PREFIX = 'admin-';

/**
 * Legacy CRUD admin tools still registered for platform_invoke dispatch
 * and /api/tools/:id/run — never exposed to the LLM / binding UI.
 */
export const ADMIN_DISPATCH_TOOL_IDS: readonly string[] = [
  'list_schedules',
  'list_adapters',
  'list_workflows',
  'list_unevaluated_news',
  'list_scored_news',
  'get_news_item',
  'list_workflow_runs',
  'get_system_stats',
  'list_recent_reports',
  'update_cron',
  'delete_cron',
  'run_schedule_now',
  'list_task_logs',
  'get_schedule_detail',
  'get_adapter_config',
  'sync_adapter',
  'clear_adapter_data',
  'list_processed_news',
  'get_selection_stats',
  'query_continuation_report',
  'delete_news',
  'batch_reset_scoring',
  'get_daily_report_json',
  'list_report_json_dates',
  'get_digest_context',
  'refresh_digest_context',
  'get_aggregated_content',
  'get_workflow_run_detail',
  'get_workflow_run',
  'list_pending_approvals',
  'get_platform_status',
  'get_governance_status',
  'get_agent_metrics',
  'get_commit_history',
  'get_publication_items',
  'republish_report',
  'delete_commit_history',
  'backfill_publication_items',
  'list_agents',
  'get_agent',
  'save_agent',
  'delete_agent',
  'list_skills',
  'scan_skills',
  'list_tools',
  'list_mcp_configs',
  'test_mcp',
  'list_workflow_templates',
  'list_agent_bindings',
  'save_workflow',
  'instantiate_template',
  'list_kb_categories',
  'list_kb_documents',
  'get_kb_content',
  'list_memory_categories',
  'get_rag_status',
  'list_plugin_metadata',
  'create_kb_category',
  'delete_kb_document',
  'get_settings',
  'update_settings',
  'test_ai_provider',
  'create_api_key',
];

/** Admin tools shown in UI and bound to super_admin LLM (platform + SOP). */
export const ADMIN_LLM_FACING_TOOL_IDS: readonly string[] = TOOL_CATEGORIES.filter((cat) =>
  cat.id.startsWith(ADMIN_CATEGORY_PREFIX),
).flatMap((cat) => cat.toolIds);

export const ADMIN_LLM_FACING_TOOL_ID_SET = new Set(ADMIN_LLM_FACING_TOOL_IDS);

export const ADMIN_DISPATCH_TOOL_ID_SET = new Set(ADMIN_DISPATCH_TOOL_IDS);

/**
 * All admin-related tool ids: LLM-facing + dispatch-only.
 * Used to strip from non-super_admin agents / public catalogs.
 */
export const ADMIN_EXCLUSIVE_TOOL_IDS: readonly string[] = [
  ...ADMIN_LLM_FACING_TOOL_IDS,
  ...ADMIN_DISPATCH_TOOL_IDS,
];

export const ADMIN_EXCLUSIVE_TOOL_ID_SET = new Set(ADMIN_EXCLUSIVE_TOOL_IDS);

export function isAdminExclusiveTool(toolId: string): boolean {
  return ADMIN_EXCLUSIVE_TOOL_ID_SET.has(toolId);
}

/** Whether this tool may be bound to the super_admin LLM. */
export function isAdminLlmFacingTool(toolId: string): boolean {
  return ADMIN_LLM_FACING_TOOL_ID_SET.has(toolId);
}

/** Dispatch-only handlers — must not appear in binding UI or agent toolIds. */
export function isAdminDispatchTool(toolId: string): boolean {
  return ADMIN_DISPATCH_TOOL_ID_SET.has(toolId);
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
