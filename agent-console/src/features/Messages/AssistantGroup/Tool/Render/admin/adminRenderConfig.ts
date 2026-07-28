export const ADMIN_CRON_RENDER_API_NAMES = [
  'createCron',
  'updateCron',
  'deleteCron',
  'runScheduleNow',
] as const;

export const ADMIN_WORKFLOW_RUN_RENDER_API_NAMES = [
  'runWorkflow',
  'triggerScoring',
  'generateDailyReport',
] as const;

export const ADMIN_QUERY_RENDER_API_NAMES = [
  'listSchedules',
  'listAdapters',
  'listWorkflows',
  'listUnevaluatedNews',
  'listScoredNews',
  'getNewsItem',
  'listWorkflowRuns',
  'getSystemStats',
  'listRecentReports',
  'listTaskLogs',
  'getScheduleDetail',
  'getAdapterConfig',
  'listProcessedNews',
  'getSelectionStats',
  'queryContinuationReport',
  'listReportJsonDates',
  'getDigestContext',
  'getAggregatedContent',
  'getWorkflowRun',
  'listPendingApprovals',
  'getPublicationItems',
  'scanSkills',
  'getSettings',
] as const;

export const ADMIN_AGENT_CATALOG_RENDER_API_NAMES = [
  'listAgents',
  'listSkills',
  'listTools',
  'listMcpConfigs',
  'listWorkflowTemplates',
] as const;

export const ADMIN_AGENT_CUSTOM_RENDER_API_NAMES = [
  'getAgent',
  'testMcp',
  'listAgentBindings',
] as const;

export const ADMIN_KNOWLEDGE_BROWSE_RENDER_API_NAMES = [
  'listKbCategories',
  'listKbDocuments',
  'listMemoryCategories',
] as const;

export const ADMIN_KNOWLEDGE_CUSTOM_RENDER_API_NAMES = [
  'getKbContent',
  'getRagStatus',
  'listPluginMetadata',
] as const;

export const ADMIN_SCHEDULING_WRITE_RENDER_API_NAMES = [
  'syncAdapter',
  'clearAdapterData',
] as const;

export const ADMIN_GENERATION_WRITE_RENDER_API_NAMES = ['refreshDigestContext'] as const;

export const ADMIN_GENERATION_CUSTOM_RENDER_API_NAMES = [
  'getDailyReportJson',
  'getWorkflowRunDetail',
] as const;

export const ADMIN_OPS_DASHBOARD_RENDER_API_NAMES = [
  'getPlatformStatus',
  'getGovernanceStatus',
  'getAgentMetrics',
] as const;

export const ADMIN_HISTORY_WRITE_RENDER_API_NAMES = [
  'republishReport',
  'deleteCommitHistory',
] as const;

export const ADMIN_HISTORY_CUSTOM_RENDER_API_NAMES = ['getCommitHistory'] as const;

export const ADMIN_AGENT_WRITE_RENDER_API_NAMES = [
  'saveAgent',
  'saveWorkflow',
  'instantiateTemplate',
] as const;

export const ADMIN_KNOWLEDGE_WRITE_RENDER_API_NAMES = ['createKbCategory'] as const;

export const ADMIN_GENERIC_WRITE_RENDER_API_NAMES = [
  'deleteAgent',
  'deleteKbDocument',
  'batchResetScoring',
  'backfillPublicationItems',
  'createApiKey',
  'testAiProvider',
  'updateSettings',
] as const;

export const ADMIN_RENDER_API_NAMES = [
  ...ADMIN_CRON_RENDER_API_NAMES,
  ...ADMIN_WORKFLOW_RUN_RENDER_API_NAMES,
  'updateNewsScore',
  'deleteNews',
  'publishReport',
  'decideWorkflowStep',
  ...ADMIN_SCHEDULING_WRITE_RENDER_API_NAMES,
  ...ADMIN_GENERATION_WRITE_RENDER_API_NAMES,
  ...ADMIN_GENERATION_CUSTOM_RENDER_API_NAMES,
  ...ADMIN_OPS_DASHBOARD_RENDER_API_NAMES,
  ...ADMIN_HISTORY_WRITE_RENDER_API_NAMES,
  ...ADMIN_HISTORY_CUSTOM_RENDER_API_NAMES,
  ...ADMIN_QUERY_RENDER_API_NAMES,
  ...ADMIN_AGENT_CATALOG_RENDER_API_NAMES,
  ...ADMIN_AGENT_CUSTOM_RENDER_API_NAMES,
  ...ADMIN_KNOWLEDGE_BROWSE_RENDER_API_NAMES,
  ...ADMIN_KNOWLEDGE_CUSTOM_RENDER_API_NAMES,
  ...ADMIN_AGENT_WRITE_RENDER_API_NAMES,
  ...ADMIN_KNOWLEDGE_WRITE_RENDER_API_NAMES,
  ...ADMIN_GENERIC_WRITE_RENDER_API_NAMES,
] as const;

export type AdminRenderApiName = (typeof ADMIN_RENDER_API_NAMES)[number];

export function formatNewsScoreDisplay(newScore: unknown): string {
  return newScore === null || newScore === undefined ? '已清空(将重新评分)' : String(newScore);
}

export function getWorkflowRunTitle(result: {
  workflowId?: unknown;
  date?: unknown;
}): string {
  const isReport =
    result.workflowId === 'ai-daily-report-json-from-summary' || Boolean(result.date);
  return isReport
    ? `日报生成已启动(${result.date ?? '今天'})`
    : `工作流「${result.workflowId ?? ''}」已启动`;
}

export function shouldShowSelectionLink(workflowId: unknown): boolean {
  return workflowId === 'feed_scoring_pipeline_workflow';
}

export function shouldShowGenerationResultLink(result: {
  workflowId?: unknown;
  date?: unknown;
}): boolean {
  return result.workflowId === 'ai-daily-report-json-from-summary' || Boolean(result.date);
}

export function getGenericResultCount(result: {
  count?: unknown;
  total?: unknown;
  items?: unknown[];
}): number {
  const items = Array.isArray(result.items) ? result.items : [];
  const count = result.count ?? result.total ?? items.length;
  return typeof count === 'number' ? count : items.length;
}

export type AdminResult = { ok: boolean; [key: string]: unknown };

export function resolveAdminRenderResult(
  args?: Record<string, unknown>,
  pluginState?: unknown,
): AdminResult {
  if (pluginState && typeof pluginState === 'object' && pluginState !== null && 'ok' in pluginState) {
    return pluginState as AdminResult;
  }
  return (args ?? {}) as AdminResult;
}

export function getWorkflowStepDecisionLabel(decision: unknown): string {
  return decision === 'approve' ? '批准' : '拒绝';
}
