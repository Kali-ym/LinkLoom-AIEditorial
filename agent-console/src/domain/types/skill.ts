export interface SkillCommand {
  category: 'command';
  label: string;
  type: string;
  desc: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  fileCount?: number;
  files?: string[];
}

export interface ProjectSkill {
  id: string;
  name: string;
  description: string;
}

export interface UserSkill {
  id: string;
  name: string;
  description: string;
  source: 'market' | 'user';
}

export interface CatalogTool {
  id: string;
  name: string;
  description: string;
  scope?: 'agent' | 'workflow' | 'system' | 'both';
  /** Tool category id, matches TOOL_CATEGORIES[].id */
  category?: string;
}

export interface CatalogAgent {
  id: string;
  name: string;
  gradient: string;
}

export interface SkillCatalog {
  commands: SkillCommand[];
  agentSkills: AgentSkill[];
  projectSkills: ProjectSkill[];
  userSkills: UserSkill[];
  tools: CatalogTool[];
  agents: CatalogAgent[];
}

// ─── Tool categories (shared across ToolsTab and the + menu) ───────────────────

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

/** Full palette per category — icon bg, badge bg/text, accent dot. */
export const TOOL_CATEGORY_MENU_STYLES: Record<
  ToolCategoryColor,
  { icon: string; badge: string; dot: string }
> = {
  sky: {
    icon: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300',
    badge: 'bg-sky-100 dark:bg-sky-500/25 text-sky-600 dark:text-sky-300',
    dot: 'bg-sky-400 dark:bg-sky-400',
  },
  teal: {
    icon: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300',
    badge: 'bg-teal-100 dark:bg-teal-500/25 text-teal-600 dark:text-teal-300',
    dot: 'bg-teal-400 dark:bg-teal-400',
  },
  amber: {
    icon: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-500/25 text-amber-600 dark:text-amber-300',
    dot: 'bg-amber-400 dark:bg-amber-400',
  },
  violet: {
    icon: 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300',
    badge: 'bg-violet-100 dark:bg-violet-500/25 text-violet-600 dark:text-violet-300',
    dot: 'bg-violet-400 dark:bg-violet-400',
  },
  rose: {
    icon: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300',
    badge: 'bg-rose-100 dark:bg-rose-500/25 text-rose-600 dark:text-rose-300',
    dot: 'bg-rose-400 dark:bg-rose-400',
  },
  emerald: {
    icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300',
    dot: 'bg-emerald-400 dark:bg-emerald-400',
  },
  slate: {
    icon: 'bg-slate-100 dark:bg-slate-500/20 text-slate-500 dark:text-slate-300',
    badge: 'bg-slate-100 dark:bg-slate-500/25 text-slate-500 dark:text-slate-300',
    dot: 'bg-slate-400 dark:bg-slate-400',
  },
  indigo: {
    icon: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300',
    badge: 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300',
    dot: 'bg-indigo-400 dark:bg-indigo-400',
  },
  orange: {
    icon: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300',
    badge: 'bg-orange-100 dark:bg-orange-500/25 text-orange-600 dark:text-orange-300',
    dot: 'bg-orange-400 dark:bg-orange-400',
  },
  red: {
    icon: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-500/25 text-red-600 dark:text-red-300',
    dot: 'bg-red-400 dark:bg-red-400',
  },
  purple: {
    icon: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300',
    badge: 'bg-purple-100 dark:bg-purple-500/25 text-purple-600 dark:text-purple-300',
    dot: 'bg-purple-400 dark:bg-purple-400',
  },
};

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'task-collab',
    label: '任务协作',
    icon: 'task_alt',
    color: 'emerald',
    toolIds: [
      'create_plan',
      'update_plan',
      'create_todos',
      'update_todos',
      'clear_todos',
      'ask_user_question',
      'batch_agent_runner',
      'reconcile_plan_coverage',
    ],
  },
  {
    id: 'web-crawl',
    label: '网页抓取',
    icon: 'travel_explore',
    color: 'sky',
    toolIds: ['crawl_single_page', 'crawl_multi_pages', 'fetch_data', 'web_search'],
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
      'query_coverage_index',
      'query_publication_history',
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
    id: 'admin-query',
    label: '管理查询',
    icon: 'admin_panel_settings',
    color: 'orange',
    toolIds: [
      'list_schedules',
      'list_adapters',
      'list_workflows',
      'list_unevaluated_news',
      'list_scored_news',
      'get_news_item',
      'list_workflow_runs',
      'list_recent_reports',
    ],
  },
  {
    id: 'admin-schedule',
    label: '调度与适配器',
    icon: 'schedule',
    color: 'purple',
    toolIds: [
      'create_cron',
      'update_cron',
      'delete_cron',
      'run_schedule_now',
      'list_task_logs',
      'get_schedule_detail',
      'get_adapter_config',
      'sync_adapter',
      'clear_adapter_data',
    ],
  },
  {
    id: 'admin-selection',
    label: '筛选与评分',
    icon: 'filter_list',
    color: 'violet',
    toolIds: [
      'list_processed_news',
      'get_selection_stats',
      'query_continuation_report',
      'trigger_scoring',
      'update_news_score',
      'delete_news',
      'batch_reset_scoring',
    ],
  },
  {
    id: 'admin-news-report',
    label: '日报与素材',
    icon: 'newspaper',
    color: 'red',
    toolIds: [
      'generate_daily_report',
      'publish_report',
      'get_daily_report_json',
      'list_report_json_dates',
      'get_digest_context',
      'refresh_digest_context',
      'get_aggregated_content',
    ],
  },
  {
    id: 'admin-workflow',
    label: '工作流与审批',
    icon: 'account_tree',
    color: 'sky',
    toolIds: [
      'run_workflow',
      'decide_workflow_step',
      'get_workflow_run',
      'get_workflow_run_detail',
      'list_pending_approvals',
    ],
  },
  {
    id: 'admin-ops',
    label: '运维与监控',
    icon: 'monitoring',
    color: 'teal',
    toolIds: [
      'get_system_stats',
      'get_platform_status',
      'get_governance_status',
      'get_agent_metrics',
    ],
  },
  {
    id: 'admin-history',
    label: '历史与发布',
    icon: 'history',
    color: 'amber',
    toolIds: [
      'get_commit_history',
      'get_publication_items',
      'republish_report',
      'delete_commit_history',
      'backfill_publication_items',
    ],
  },
  {
    id: 'admin-agents',
    label: '智能体与配置',
    icon: 'smart_toy',
    color: 'indigo',
    toolIds: [
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
    ],
  },
  {
    id: 'admin-knowledge',
    label: '知识库与记忆',
    icon: 'menu_book',
    color: 'emerald',
    toolIds: [
      'list_kb_categories',
      'list_kb_documents',
      'get_kb_content',
      'list_memory_categories',
      'get_rag_status',
      'list_plugin_metadata',
      'create_kb_category',
      'delete_kb_document',
    ],
  },
  {
    id: 'admin-settings',
    label: '系统设置',
    icon: 'tune',
    color: 'slate',
    toolIds: ['get_settings', 'update_settings', 'test_ai_provider', 'create_api_key'],
  },
];

/** Build a map from toolId → category for O(1) lookups. */
export function buildToolCategoryMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of TOOL_CATEGORIES) {
    for (const id of cat.toolIds) map.set(id, cat.id);
  }
  return map;
}
