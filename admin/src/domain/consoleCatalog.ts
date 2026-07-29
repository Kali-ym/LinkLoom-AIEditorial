export type ToolCategoryColor =
  | 'sky'
  | 'teal'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'emerald'
  | 'slate'
  | 'indigo'
  | 'orange'
  | 'red'
  | 'purple';

export interface ToolCategory {
  id: string;
  label: string;
  icon: string;
  color: ToolCategoryColor;
  toolIds: string[];
}

/** Keep in sync with agent-console/src/domain/types/skill.ts public + admin categories. */
export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'task-collab',
    label: '任务协作',
    icon: 'task_alt',
    color: 'emerald',
    toolIds: [
      'ask_user_question',
      'batch_agent_runner',
      'reconcile_plan_coverage',
      'create_plan',
      'update_plan',
      'create_todos',
      'update_todos',
      'clear_todos',
    ],
  },
  {
    id: 'web-crawl',
    label: '网页抓取',
    icon: 'travel_explore',
    color: 'sky',
    toolIds: ['crawl_pages', 'crawl_single_page', 'crawl_multi_pages', 'web_search'],
  },
  {
    id: 'data-query',
    label: '数据查询',
    icon: 'database_search',
    color: 'teal',
    toolIds: [
      'query_data',
      'query_knowledge',
      'query_memory',
      'query_publication_history',
      'query_coverage_index',
      'fetch_data',
    ],
  },
  {
    id: 'content-processing',
    label: '内容处理',
    icon: 'auto_fix_high',
    color: 'violet',
    toolIds: ['build_daily_report_json', 'normalize_report_markdown', 'deduplicate_items'],
  },
  {
    id: 'publishing',
    label: '多渠道发布',
    icon: 'rocket_launch',
    color: 'amber',
    toolIds: [
      'publish_to_github',
      'publish_to_local_site',
      'publish_to_wechat',
      'render_standard_wechat_article',
    ],
  },
  {
    id: 'workspace',
    label: '工作区与系统',
    icon: 'terminal',
    color: 'rose',
    toolIds: [
      'list_dir',
      'glob',
      'grep',
      'read_workspace_file',
      'write_workspace_file',
      'edit_workspace_file',
      'execute_command',
      'read_upload',
      'list_skill',
      'read_skill',
    ],
  },
  {
    id: 'knowledge-memory',
    label: '知识与记忆',
    icon: 'psychology',
    color: 'indigo',
    toolIds: ['save_knowledge', 'save_memory'],
  },
  {
    id: 'admin-platform',
    label: '平台 API',
    icon: 'admin_panel_settings',
    color: 'orange',
    toolIds: ['platform_discover', 'platform_invoke'],
  },
  {
    id: 'admin-sop',
    label: '运维 SOP',
    icon: 'rocket_launch',
    color: 'purple',
    toolIds: [
      'create_cron',
      'trigger_scoring',
      'generate_daily_report',
      'publish_report',
      'run_workflow',
      'decide_workflow_step',
      'update_news_score',
      'rebuild_hot_snapshot',
    ],
  },
];

/** Legacy CRUD still registered for platform_invoke dispatch. */
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
  'list_raw_news',
  'import_opml',
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
  'delete_workflow',
  'dry_run_workflow_step',
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
  'list_agent_runs',
  'get_agent_run',
  'list_agent_run_messages',
  'cancel_agent_run',
  'retry_agent_run',
  'list_pending_agent_hitl',
  'list_pending_agent_permissions',
  'approve_agent_permission',
  'reject_agent_permission',
  'resolve_agent_hitl',
  'list_agent_session_messages',
  'list_kb_categories',
  'list_kb_documents',
  'get_kb_content',
  'list_memory_categories',
  'get_rag_status',
  'rag_reindex',
  'list_rag_jobs',
  'run_rag_jobs_once',
  'run_rag_eval',
  'list_rag_eval_runs',
  'list_plugin_metadata',
  'create_kb_category',
  'delete_kb_document',
  'get_settings',
  'update_settings',
  'test_ai_provider',
  'create_api_key',
];

export const SUPER_ADMIN_AGENT_ID = 'super_admin';

const ADMIN_CATEGORY_PREFIX = 'admin-';

export const ADMIN_EXCLUSIVE_TOOL_IDS: readonly string[] = [
  ...TOOL_CATEGORIES.filter((cat) => cat.id.startsWith(ADMIN_CATEGORY_PREFIX)).flatMap(
    (cat) => cat.toolIds,
  ),
  ...ADMIN_DISPATCH_TOOL_IDS,
];

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

export function getPublicToolCategories() {
  return TOOL_CATEGORIES.filter((cat) => !isAdminToolCategory(cat.id));
}

export function excludeAdminExclusiveTools<T extends { id: string }>(tools: readonly T[]): T[] {
  return tools.filter((tool) => !isAdminExclusiveTool(tool.id));
}

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
