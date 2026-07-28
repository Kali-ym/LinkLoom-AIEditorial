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
    icon: 'auto_awesome',
    color: 'amber',
    toolIds: [
      'generate_daily_report',
      'generate_daily_report_json',
      'generate_daily_report_json_from_summary',
      'generate_daily_report_json_from_raw',
      'evaluate_daily_report',
      'create_daily_quality_gate',
      'rewrite_article',
      'republish_report',
      'translate_article',
    ],
  },
  {
    id: 'publishing',
    label: '发布',
    icon: 'rocket_launch',
    color: 'violet',
    toolIds: [
      'publish_to_wordpress',
      'publish_to_wechat',
      'publish_to_github',
      'publish_to_twitter',
      'publish_to_jina',
      'publish_to_notion',
      'publish_to_linear',
    ],
  },
  {
    id: 'workspace',
    label: '工作区',
    icon: 'terminal',
    color: 'slate',
    toolIds: [
      'read_file',
      'write_file',
      'list_files',
      'execute_command',
      'execute_command_in_session',
      'install_skill',
      'list_installable_skills',
    ],
  },
  {
    id: 'knowledge-memory',
    label: '知识 / 记忆',
    icon: 'psychology',
    color: 'indigo',
    toolIds: [
      'save_knowledge',
      'save_memory',
    ],
  },
];

export const SUPER_ADMIN_AGENT_ID = 'super_admin';

const ADMIN_CATEGORY_PREFIX = 'admin-';

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
