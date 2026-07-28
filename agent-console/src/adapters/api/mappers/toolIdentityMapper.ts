import { TOOLSET_IDS } from '../../../domain/constants/toolsetIdentifiers';

/** Resolved Console tool identity for Render / Streaming / Intervention registries. */
export interface LinkLoomToolIdentity {
  identifier: string;
  apiName: string;
  /** Plugin id for settingsSchema / portal routing (defaults to identifier). */
  plugin: string;
  /** Canonical LinkLoom backend tool id when known. */
  linkloomToolId?: string;
}

export interface ResolveToolIdentityInput {
  /** Provider-facing tool name from SSE (`toolName` / `exposedName`). */
  toolName: string;
  exposedName?: string;
  mcpServerId?: string;
}

type ToolMappingEntry = LinkLoomToolIdentity & {
  /** Backend tool id / exposed name aliases (case-insensitive). */
  keys: string[];
};

function normalizeToolKey(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, '_');
}

function entry(
  keys: string[],
  identifier: string,
  apiName: string,
  linkloomToolId?: string,
): ToolMappingEntry {
  const plugin = identifier;
  return { keys, identifier, apiName, plugin, linkloomToolId: linkloomToolId ?? keys[0] };
}

/**
 * Authoritative map: LinkLoom backend tool id/name → Console (identifier, apiName).
 * Keys include id/name aliases (e.g. read_upload + readUpload).
 */
const LINKLOOM_TOOL_MAPPINGS: ToolMappingEntry[] = [
  // —— Copilot / knowledge / memory ——
  entry(['query_knowledge'], TOOLSET_IDS.KNOWLEDGE_BASE, 'searchKnowledgeBase'),
  entry(['save_knowledge'], TOOLSET_IDS.AGENT_DOCUMENTS, 'createDocument'),
  entry(['query_memory'], TOOLSET_IDS.USER_MEMORY, 'searchUserMemory'),
  entry(['save_memory'], TOOLSET_IDS.USER_MEMORY, 'addExperienceMemory'),
  entry(['query_data'], TOOLSET_IDS.DATA, 'queryData'),
  entry(['query_publication_history'], TOOLSET_IDS.DATA, 'queryPublicationHistory'),

  // —— Files / commands ——
  entry(['read_upload', 'readupload'], TOOLSET_IDS.LOCAL_SYSTEM, 'readFile'),
  entry(['read_workspace_file', 'readworkspacefile', 'readfile'], TOOLSET_IDS.LOCAL_SYSTEM, 'readFile'),
  entry(['write_file', 'writefile'], TOOLSET_IDS.LOCAL_SYSTEM, 'writeFile'),
  entry(['write_workspace_file', 'writeworkspacefile'], TOOLSET_IDS.LOCAL_SYSTEM, 'writeFile'),
  entry(['edit_workspace_file', 'editworkspacefile', 'editfile'], TOOLSET_IDS.LOCAL_SYSTEM, 'editFile'),
  entry(['delete_workspace_file', 'deleteworkspacefile', 'deletefile'], TOOLSET_IDS.LOCAL_SYSTEM, 'deleteFile'),
  entry(['execute_command'], TOOLSET_IDS.LOCAL_SYSTEM, 'runCommand'),

  // —— Agent orchestration ——
  entry(['batch_agent_runner'], TOOLSET_IDS.AGENT, 'callSubAgent'),

  // —— Skills (phase B — backend tools planned) ——
  entry(['read_skill'], TOOLSET_IDS.SKILLS, 'readReference'),
  entry(['list_skill'], TOOLSET_IDS.SKILL_STORE, 'searchSkill'),

  // —— Workspace todos/plan (phase C — backend tools planned) ——
  entry(['create_todos'], TOOLSET_IDS.AGENT, 'createTodos'),
  entry(['update_todos'], TOOLSET_IDS.AGENT, 'updateTodos'),
  entry(['clear_todos'], TOOLSET_IDS.AGENT, 'clearTodos'),
  entry(['create_plan'], TOOLSET_IDS.AGENT, 'createPlan'),
  entry(['update_plan'], TOOLSET_IDS.AGENT, 'updatePlan'),

  // —— User interaction ——
  entry(['ask_user_question', 'askuserquestion'], TOOLSET_IDS.USER_INTERACTION, 'askUserQuestion'),

  // —— Web browsing (phase E — backend tools planned) ——
  entry(['web_search'], TOOLSET_IDS.WEB_BROWSING, 'search'),
  entry(['crawl_single_page'], TOOLSET_IDS.WEB_BROWSING, 'crawlSinglePage'),
  entry(['crawl_multi_pages'], TOOLSET_IDS.WEB_BROWSING, 'crawlMultiPages'),

  // —— Workflow-only tools (generic workflow Render) ——
  entry(['fetch_data'], TOOLSET_IDS.WORKFLOW, 'fetchData'),
  entry(['build_daily_report_json'], TOOLSET_IDS.WORKFLOW, 'buildDailyReportJson'),
  entry(['reconcile_plan_coverage'], TOOLSET_IDS.WORKFLOW, 'reconcilePlanCoverage'),
  entry(['deduplicate_items'], TOOLSET_IDS.WORKFLOW, 'deduplicateItems'),
  entry(['query_coverage_index'], TOOLSET_IDS.WORKFLOW, 'queryCoverageIndex'),
  entry(['normalize_report_markdown'], TOOLSET_IDS.WORKFLOW, 'normalizeReportMarkdown'),
  entry(['render_standard_wechat_article'], TOOLSET_IDS.WORKFLOW, 'renderStandardWechatArticle'),
  entry(['publish_to_wechat'], TOOLSET_IDS.WORKFLOW, 'publishToWechat'),
  entry(['publish_to_github'], TOOLSET_IDS.WORKFLOW, 'publishToGitHub'),
  entry(['publish_to_local_site'], TOOLSET_IDS.WORKFLOW, 'publishToLocalSite'),

  // —— Super admin tools (phase SA — see super-admin-agent-backend plan) ——
  entry(['list_schedules'], TOOLSET_IDS.ADMIN, 'listSchedules'),
  entry(['list_adapters'], TOOLSET_IDS.ADMIN, 'listAdapters'),
  entry(['list_workflows'], TOOLSET_IDS.ADMIN, 'listWorkflows'),
  entry(['list_unevaluated_news'], TOOLSET_IDS.ADMIN, 'listUnevaluatedNews'),
  entry(['list_scored_news'], TOOLSET_IDS.ADMIN, 'listScoredNews'),
  entry(['get_news_item'], TOOLSET_IDS.ADMIN, 'getNewsItem'),
  entry(['list_workflow_runs'], TOOLSET_IDS.ADMIN, 'listWorkflowRuns'),
  entry(['get_system_stats'], TOOLSET_IDS.ADMIN, 'getSystemStats'),
  entry(['list_recent_reports'], TOOLSET_IDS.ADMIN, 'listRecentReports'),
  entry(['create_cron'], TOOLSET_IDS.ADMIN, 'createCron'),
  entry(['update_cron'], TOOLSET_IDS.ADMIN, 'updateCron'),
  entry(['delete_cron'], TOOLSET_IDS.ADMIN, 'deleteCron'),
  entry(['run_schedule_now'], TOOLSET_IDS.ADMIN, 'runScheduleNow'),
  entry(['run_workflow'], TOOLSET_IDS.ADMIN, 'runWorkflow'),
  entry(['trigger_scoring'], TOOLSET_IDS.ADMIN, 'triggerScoring'),
  entry(['decide_workflow_step'], TOOLSET_IDS.ADMIN, 'decideWorkflowStep'),
  entry(['update_news_score'], TOOLSET_IDS.ADMIN, 'updateNewsScore'),
  entry(['delete_news'], TOOLSET_IDS.ADMIN, 'deleteNews'),
  entry(['generate_daily_report'], TOOLSET_IDS.ADMIN, 'generateDailyReport'),
  entry(['publish_report'], TOOLSET_IDS.ADMIN, 'publishReport'),
  entry(['list_task_logs'], TOOLSET_IDS.ADMIN, 'listTaskLogs'),
  entry(['get_schedule_detail'], TOOLSET_IDS.ADMIN, 'getScheduleDetail'),
  entry(['get_adapter_config'], TOOLSET_IDS.ADMIN, 'getAdapterConfig'),
  entry(['sync_adapter'], TOOLSET_IDS.ADMIN, 'syncAdapter'),
  entry(['clear_adapter_data'], TOOLSET_IDS.ADMIN, 'clearAdapterData'),
  entry(['list_processed_news'], TOOLSET_IDS.ADMIN, 'listProcessedNews'),
  entry(['get_selection_stats'], TOOLSET_IDS.ADMIN, 'getSelectionStats'),
  entry(['query_continuation_report'], TOOLSET_IDS.ADMIN, 'queryContinuationReport'),

  // —— Super admin phase 2 — generation ——
  entry(['get_daily_report_json'], TOOLSET_IDS.ADMIN, 'getDailyReportJson'),
  entry(['list_report_json_dates'], TOOLSET_IDS.ADMIN, 'listReportJsonDates'),
  entry(['get_digest_context'], TOOLSET_IDS.ADMIN, 'getDigestContext'),
  entry(['refresh_digest_context'], TOOLSET_IDS.ADMIN, 'refreshDigestContext'),
  entry(['get_aggregated_content'], TOOLSET_IDS.ADMIN, 'getAggregatedContent'),
  entry(['get_workflow_run_detail'], TOOLSET_IDS.ADMIN, 'getWorkflowRunDetail'),

  // —— Super admin phase 2 — ops ——
  entry(['get_workflow_run'], TOOLSET_IDS.ADMIN, 'getWorkflowRun'),
  entry(['list_pending_approvals'], TOOLSET_IDS.ADMIN, 'listPendingApprovals'),
  entry(['get_platform_status'], TOOLSET_IDS.ADMIN, 'getPlatformStatus'),
  entry(['get_governance_status'], TOOLSET_IDS.ADMIN, 'getGovernanceStatus'),
  entry(['get_agent_metrics'], TOOLSET_IDS.ADMIN, 'getAgentMetrics'),

  // —— Super admin phase 2 — history ——
  entry(['get_commit_history'], TOOLSET_IDS.ADMIN, 'getCommitHistory'),
  entry(['get_publication_items'], TOOLSET_IDS.ADMIN, 'getPublicationItems'),
  entry(['republish_report'], TOOLSET_IDS.ADMIN, 'republishReport'),
  entry(['delete_commit_history'], TOOLSET_IDS.ADMIN, 'deleteCommitHistory'),

  // —— Super admin phase 3 — agent catalog ——
  entry(['list_agents'], TOOLSET_IDS.ADMIN, 'listAgents'),
  entry(['get_agent'], TOOLSET_IDS.ADMIN, 'getAgent'),
  entry(['list_skills'], TOOLSET_IDS.ADMIN, 'listSkills'),
  entry(['scan_skills'], TOOLSET_IDS.ADMIN, 'scanSkills'),
  entry(['list_tools'], TOOLSET_IDS.ADMIN, 'listTools'),
  entry(['list_mcp_configs'], TOOLSET_IDS.ADMIN, 'listMcpConfigs'),
  entry(['test_mcp'], TOOLSET_IDS.ADMIN, 'testMcp'),
  entry(['list_workflow_templates'], TOOLSET_IDS.ADMIN, 'listWorkflowTemplates'),
  entry(['list_agent_bindings'], TOOLSET_IDS.ADMIN, 'listAgentBindings'),

  // —— Super admin phase 3 — knowledge catalog ——
  entry(['list_kb_categories'], TOOLSET_IDS.ADMIN, 'listKbCategories'),
  entry(['list_kb_documents'], TOOLSET_IDS.ADMIN, 'listKbDocuments'),
  entry(['get_kb_content'], TOOLSET_IDS.ADMIN, 'getKbContent'),
  entry(['list_memory_categories'], TOOLSET_IDS.ADMIN, 'listMemoryCategories'),
  entry(['get_rag_status'], TOOLSET_IDS.ADMIN, 'getRagStatus'),
  entry(['list_plugin_metadata'], TOOLSET_IDS.ADMIN, 'listPluginMetadata'),

  // —— Super admin phase 4 — agent / workflow writes ——
  entry(['save_agent'], TOOLSET_IDS.ADMIN, 'saveAgent'),
  entry(['delete_agent'], TOOLSET_IDS.ADMIN, 'deleteAgent'),
  entry(['save_workflow'], TOOLSET_IDS.ADMIN, 'saveWorkflow'),
  entry(['instantiate_template'], TOOLSET_IDS.ADMIN, 'instantiateTemplate'),

  // —— Super admin phase 4 — settings ——
  entry(['get_settings'], TOOLSET_IDS.ADMIN, 'getSettings'),
  entry(['update_settings'], TOOLSET_IDS.ADMIN, 'updateSettings'),
  entry(['test_ai_provider'], TOOLSET_IDS.ADMIN, 'testAiProvider'),
  entry(['create_api_key'], TOOLSET_IDS.ADMIN, 'createApiKey'),

  // —— Super admin phase 4 — knowledge writes ——
  entry(['create_kb_category'], TOOLSET_IDS.ADMIN, 'createKbCategory'),
  entry(['delete_kb_document'], TOOLSET_IDS.ADMIN, 'deleteKbDocument'),

  // —— Super admin phase 4 — batch ops ——
  entry(['batch_reset_scoring'], TOOLSET_IDS.ADMIN, 'batchResetScoring'),
  entry(['backfill_publication_items'], TOOLSET_IDS.ADMIN, 'backfillPublicationItems'),
];

const TOOL_IDENTITY_BY_KEY = new Map<string, LinkLoomToolIdentity>();

for (const mapping of LINKLOOM_TOOL_MAPPINGS) {
  const { keys, ...identity } = mapping;
  for (const key of keys) {
    TOOL_IDENTITY_BY_KEY.set(normalizeToolKey(key), identity);
  }
}

/** Parse MCP combined tool name `{serverId}__{toolName}` from backend runtime. */
export function parseMcpCombinedToolName(toolName: string): { serverKey: string; mcpApiName: string } | null {
  const sep = toolName.indexOf('__');
  if (sep <= 0 || sep >= toolName.length - 2) return null;
  return {
    serverKey: toolName.slice(0, sep),
    mcpApiName: toolName.slice(sep + 2),
  };
}

function lookupBuiltinIdentity(toolName: string): LinkLoomToolIdentity | undefined {
  const key = normalizeToolKey(toolName);
  return TOOL_IDENTITY_BY_KEY.get(key);
}

function resolveMcpIdentity(toolName: string, mcpServerId: string): LinkLoomToolIdentity {
  const parsed = parseMcpCombinedToolName(toolName);
  const mcpApiName = parsed?.mcpApiName ?? toolName;
  return {
    identifier: TOOLSET_IDS.MCP,
    apiName: mcpApiName,
    plugin: `mcp:${mcpServerId}`,
    linkloomToolId: `mcp:${mcpServerId}:${mcpApiName}`,
  };
}

function resolveGenericIdentity(toolName: string): LinkLoomToolIdentity {
  const normalized = normalizeToolKey(toolName);
  const apiName = normalized
    .split('_')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
  return {
    identifier: TOOLSET_IDS.GENERIC,
    apiName: apiName || 'tool',
    plugin: normalized || 'tool',
    linkloomToolId: normalized || undefined,
  };
}

/**
 * Resolve backend SSE tool fields to Console (identifier, apiName) for UI registries.
 */
export function resolveLinkLoomToolIdentity(input: ResolveToolIdentityInput): LinkLoomToolIdentity {
  const primaryName = input.toolName.trim() || input.exposedName?.trim() || 'tool';

  if (input.mcpServerId) {
    return resolveMcpIdentity(primaryName, input.mcpServerId);
  }

  const candidates = [input.toolName, input.exposedName, primaryName].filter(
    (name): name is string => Boolean(name?.trim()),
  );

  for (const candidate of candidates) {
    const match = lookupBuiltinIdentity(candidate);
    if (match) return { ...match };
  }

  return resolveGenericIdentity(primaryName);
}

/** Whether a tool name has an explicit backend mapping (excludes generic fallback). */
export function isMappedLinkLoomTool(toolName: string): boolean {
  return Boolean(lookupBuiltinIdentity(toolName));
}

/** All explicit mappings (for catalog / debug). */
export function listLinkLoomToolMappings(): ReadonlyArray<LinkLoomToolIdentity & { keys: string[] }> {
  return LINKLOOM_TOOL_MAPPINGS.map(({ keys, ...identity }) => ({ keys, ...identity }));
}

// Re-export canonical ids for consumers.
export { TOOLSET_IDS };
