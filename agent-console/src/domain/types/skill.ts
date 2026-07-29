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

/** Build a map from toolId → category for O(1) lookups. */
export function buildToolCategoryMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of TOOL_CATEGORIES) {
    for (const id of cat.toolIds) map.set(id, cat.id);
  }
  return map;
}
