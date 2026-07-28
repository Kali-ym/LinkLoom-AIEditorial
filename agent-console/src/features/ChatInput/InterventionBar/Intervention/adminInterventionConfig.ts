/** Admin write-tool apiNames that require HITL confirmation (27 total). */
export const ADMIN_WRITE_INTERVENTION_API_NAMES = [
  'createCron',
  'updateCron',
  'deleteCron',
  'runScheduleNow',
  'runWorkflow',
  'triggerScoring',
  'decideWorkflowStep',
  'updateNewsScore',
  'deleteNews',
  'generateDailyReport',
  'publishReport',
  'syncAdapter',
  'clearAdapterData',
  'refreshDigestContext',
  'republishReport',
  'deleteCommitHistory',
  'saveAgent',
  'deleteAgent',
  'saveWorkflow',
  'instantiateTemplate',
  'updateSettings',
  'testAiProvider',
  'createApiKey',
  'createKbCategory',
  'deleteKbDocument',
  'batchResetScoring',
  'backfillPublicationItems',
] as const;

export type AdminWriteInterventionApiName = (typeof ADMIN_WRITE_INTERVENTION_API_NAMES)[number];

export const ADMIN_HIGH_RISK_INTERVENTION_API_NAMES = new Set<AdminWriteInterventionApiName>([
  'deleteCron',
  'deleteNews',
  'publishReport',
  'clearAdapterData',
  'deleteCommitHistory',
  'deleteAgent',
  'deleteKbDocument',
  'updateSettings',
]);

export const ADMIN_PARAM_LABELS: Record<string, string> = {
  name: '任务名称',
  type: '类型',
  cronExpr: 'cron 表达式',
  targetId: '目标',
  enabled: '启用',
  scheduleId: '任务 id',
  patch: '修改字段',
  newsId: '新闻 id',
  action: '操作',
  score: '分数',
  workflowId: '工作流 id',
  input: '输入',
  date: '日期',
  contentId: '内容 id',
  channels: '渠道',
  runId: '运行 id',
  historyId: '发布历史 id',
  rangeFrom: '范围起始',
  rangeTo: '范围结束',
  platform: '发布平台',
  dryRun: '试运行',
  stepId: '步骤 id',
  decision: '决定',
  comment: '意见',
  adapterName: '适配器名称',
  taskId: '任务 id',
  offset: '偏移量',
  asOfDate: '基准日期',
  lookbackDays: '回溯天数',
  namespace: '命名空间',
  picked: '已入选',
  sourceType: '来源类型',
  agent: '智能体',
  workflow: '工作流',
  templateId: '模板 id',
  providerId: '提供商 id',
  providerConfig: '提供商配置',
  newsIds: '新闻 id 列表',
  categoryName: '分类名称',
  documentId: '文档 id',
  apiKeyName: 'API Key 名称',
};

export function formatAdminArgValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? value.join(', ') : '空';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function isHighRiskAdminIntervention(apiName?: string): boolean {
  return Boolean(apiName && ADMIN_HIGH_RISK_INTERVENTION_API_NAMES.has(apiName as AdminWriteInterventionApiName));
}

export const ADMIN_REGUIDE_REJECT_REASON = '用户要求修改参数，请重新引导';
