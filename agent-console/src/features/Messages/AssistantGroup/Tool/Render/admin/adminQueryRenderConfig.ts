import type { AdminRenderApiName } from './adminRenderConfig';
import { getGenericResultCount } from './adminRenderConfig';

export type QueryColumnDef = {
  key: string;
  label: string;
  format?: (row: Record<string, unknown>) => string;
};

export type QueryRenderMeta = {
  columns: QueryColumnDef[];
  link: string;
  linkLabel: string;
};

const fmt = (row: Record<string, unknown>, key: string) => {
  const v = row[key];
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
};

export const ADMIN_QUERY_RENDER_META: Partial<Record<AdminRenderApiName, QueryRenderMeta>> = {
  listSchedules: {
    columns: [
      { key: 'name', label: '名称' },
      { key: 'cronExpr', label: 'cron' },
      { key: 'type', label: '类型' },
      { key: 'enabled', label: '启用', format: (r) => fmt(r, 'enabled') },
    ],
    link: '/scheduling',
    linkLabel: '在 /scheduling 查看',
  },
  listAdapters: {
    columns: [
      { key: 'name', label: '名称' },
      { key: 'status', label: '状态' },
      { key: 'lastRun', label: '上次运行' },
    ],
    link: '/scheduling',
    linkLabel: '在 /scheduling 查看',
  },
  listWorkflows: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
      { key: 'stepCount', label: '步骤' },
    ],
    link: '/agents',
    linkLabel: '在 /agents 查看',
  },
  listUnevaluatedNews: {
    columns: [
      { key: 'title', label: '标题' },
      { key: 'source', label: '来源' },
      { key: 'publishedAt', label: '时间' },
    ],
    link: '/selection',
    linkLabel: '在 /selection 查看',
  },
  listScoredNews: {
    columns: [
      { key: 'title', label: '标题' },
      { key: 'score', label: '分数' },
      { key: 'topic', label: '主题' },
    ],
    link: '/selection',
    linkLabel: '在 /selection 查看',
  },
  getNewsItem: {
    columns: [
      { key: 'title', label: '标题' },
      { key: 'source', label: '来源' },
      { key: 'score', label: '分数' },
      { key: 'topic', label: '主题' },
    ],
    link: '/selection',
    linkLabel: '在 /selection 查看',
  },
  listWorkflowRuns: {
    columns: [
      { key: 'runId', label: 'runId' },
      { key: 'workflowId', label: '工作流' },
      { key: 'status', label: '状态' },
    ],
    link: '/ops',
    linkLabel: '在 /ops 查看',
  },
  getSystemStats: {
    columns: [
      { key: 'label', label: '指标' },
      { key: 'value', label: '值' },
    ],
    link: '/ops',
    linkLabel: '在 /ops 查看',
  },
  listRecentReports: {
    columns: [
      { key: 'date', label: '日期' },
      { key: 'title', label: '标题' },
      { key: 'status', label: '状态' },
    ],
    link: '/history',
    linkLabel: '在 /history 查看',
  },
  listTaskLogs: {
    columns: [
      { key: 'taskName', label: '任务' },
      { key: 'status', label: '状态' },
      { key: 'startTime', label: '开始时间' },
      { key: 'message', label: '消息' },
    ],
    link: '/scheduling',
    linkLabel: '在 /scheduling 查看',
  },
  getScheduleDetail: {
    columns: [
      { key: 'name', label: '名称' },
      { key: 'cronExpr', label: 'cron' },
      { key: 'type', label: '类型' },
      { key: 'enabled', label: '启用', format: (r) => fmt(r, 'enabled') },
    ],
    link: '/scheduling',
    linkLabel: '在 /scheduling 查看',
  },
  getAdapterConfig: {
    columns: [
      { key: 'name', label: '名称' },
      { key: 'status', label: '状态' },
      { key: 'lastRun', label: '上次运行' },
    ],
    link: '/scheduling',
    linkLabel: '在 /scheduling 查看',
  },
  listProcessedNews: {
    columns: [
      { key: 'title', label: '标题' },
      { key: 'score', label: '分数' },
      { key: 'topic', label: '主题' },
      { key: 'source', label: '来源' },
    ],
    link: '/selection',
    linkLabel: '在 /selection 查看',
  },
  listPendingApprovals: {
    columns: [
      { key: 'runId', label: 'runId' },
      { key: 'stepId', label: 'stepId' },
      { key: 'toolName', label: '工具' },
      { key: 'status', label: '状态' },
    ],
    link: '/ops',
    linkLabel: '在 /ops 查看待审批',
  },
  getCommitHistory: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'date', label: '日期' },
      { key: 'platform', label: '平台' },
      { key: 'title', label: '标题' },
    ],
    link: '/history',
    linkLabel: '在 /history 查看',
  },
  listReportJsonDates: {
    columns: [
      { key: 'date', label: '日期' },
      { key: 'storyCount', label: '故事数' },
    ],
    link: '/generation',
    linkLabel: '在 /generation 查看',
  },
  getPublicationItems: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'title', label: '标题' },
      { key: 'channel', label: '渠道' },
      { key: 'status', label: '状态' },
    ],
    link: '/history',
    linkLabel: '在 /history 查看',
  },
  scanSkills: {
    columns: [
      { key: 'status', label: '状态' },
      { key: 'added', label: '新增' },
      { key: 'updated', label: '更新' },
    ],
    link: '/agents',
    linkLabel: '在 /agents 查看技能',
  },
  listAgents: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
      { key: 'category', label: '分类' },
      { key: 'toolCount', label: '工具数' },
    ],
    link: '/agents',
    linkLabel: '在 /agents 查看',
  },
  listSkills: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
    link: '/agents',
    linkLabel: '在 /agents 查看技能',
  },
  listTools: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
      { key: 'description', label: '描述' },
    ],
    link: '/agents',
    linkLabel: '在 /agents 查看工具',
  },
  listMcpConfigs: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
    link: '/settings',
    linkLabel: '在 /settings 查看 MCP',
  },
  listWorkflowTemplates: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
      { key: 'agentCount', label: '智能体' },
      { key: 'workflowCount', label: '工作流' },
    ],
    link: '/agents',
    linkLabel: '在 /agents 查看模板',
  },
  listKbCategories: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
    link: '/knowledge',
    linkLabel: '在 /knowledge 查看',
  },
  listKbDocuments: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
    link: '/knowledge',
    linkLabel: '在 /knowledge 查看文档',
  },
  listMemoryCategories: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
    link: '/knowledge',
    linkLabel: '在 /knowledge 查看记忆',
  },
  listPluginMetadata: {
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
    link: '/settings',
    linkLabel: '在 /settings 查看插件',
  },
  getSettings: {
    columns: [
      { key: 'label', label: '设置键' },
      { key: 'value', label: '值' },
    ],
    link: '/settings',
    linkLabel: '在 /settings 查看完整配置',
  },
};

export function getQueryRenderLink(apiName: string): string | undefined {
  return ADMIN_QUERY_RENDER_META[apiName as AdminRenderApiName]?.link;
}

export function normalizeQueryRows(
  apiName: string,
  result: Record<string, unknown>,
): Record<string, unknown>[] {
  if (apiName === 'getSystemStats' && result.stats && typeof result.stats === 'object') {
    return Object.entries(result.stats as Record<string, unknown>).map(([label, value]) => ({
      label,
      value,
    }));
  }
  if (apiName === 'getSettings' && result.settings && typeof result.settings === 'object') {
    return Object.entries(result.settings as Record<string, unknown>).map(([label, value]) => ({
      label,
      value: typeof value === 'object' ? JSON.stringify(value) : value,
    }));
  }
  if (apiName === 'getNewsItem' && result.item && typeof result.item === 'object') {
    return [result.item as Record<string, unknown>];
  }
  if (apiName === 'getScheduleDetail' && result.schedule && typeof result.schedule === 'object') {
    return [result.schedule as Record<string, unknown>];
  }
  if (apiName === 'getAdapterConfig' && result.name) {
    return [
      {
        name: result.name,
        status: result.status,
        lastRun: result.lastRun,
      },
    ];
  }
  if (apiName === 'getCommitHistory' && Array.isArray(result.commits)) {
    return result.commits as Record<string, unknown>[];
  }
  if (apiName === 'listReportJsonDates' && Array.isArray(result.dates)) {
    return result.dates as Record<string, unknown>[];
  }
  if (apiName === 'getWorkflowRun' && result.run && typeof result.run === 'object') {
    const run = result.run as Record<string, unknown>;
    return [
      {
        runId: run.id ?? run.runId,
        workflowId: run.workflowId,
        status: run.status,
      },
    ];
  }
  if (apiName === 'scanSkills') {
    return [
      {
        status: result.status,
        added: result.added,
        updated: result.updated,
      },
    ];
  }
  if (apiName === 'getAgent' && result.agent && typeof result.agent === 'object') {
    const agent = result.agent as Record<string, unknown>;
    const toolIds = Array.isArray(agent.toolIds) ? agent.toolIds : [];
    return [
      {
        id: agent.id,
        name: agent.name,
        category: agent.category,
        toolCount: toolIds.length,
      },
    ];
  }
  if (apiName === 'listKbDocuments' && Array.isArray(result.documents)) {
    return result.documents as Record<string, unknown>[];
  }
  if (
    (apiName === 'listKbCategories' || apiName === 'listMemoryCategories') &&
    Array.isArray(result.categories)
  ) {
    return result.categories as Record<string, unknown>[];
  }
  if (apiName === 'listSkills' && Array.isArray(result.skills)) {
    return result.skills as Record<string, unknown>[];
  }
  if (apiName === 'listMcpConfigs' && Array.isArray(result.configs)) {
    return result.configs as Record<string, unknown>[];
  }
  if (apiName === 'listWorkflowTemplates' && Array.isArray(result.templates)) {
    return result.templates as Record<string, unknown>[];
  }
  if (apiName === 'listPluginMetadata' && Array.isArray(result.plugins)) {
    return result.plugins as Record<string, unknown>[];
  }
  if (apiName === 'listAgentBindings' && Array.isArray(result.bindings)) {
    return result.bindings as Record<string, unknown>[];
  }
  const items = Array.isArray(result.items) ? result.items : [];
  return items as Record<string, unknown>[];
}

export function getQueryResultCount(apiName: string, result: Record<string, unknown>): number {
  const generic = getGenericResultCount(result);
  if (generic > 0) return generic;
  if (apiName === 'getSelectionStats' && result.stats && typeof result.stats === 'object') {
    return Object.keys(result.stats as Record<string, unknown>).length;
  }
  if (apiName === 'queryContinuationReport' && Array.isArray(result.matches)) {
    return result.matches.length;
  }
  if (apiName === 'getCommitHistory' && typeof result.total === 'number') {
    return result.total;
  }
  if (apiName === 'listReportJsonDates' && Array.isArray(result.dates)) {
    return result.dates.length;
  }
  return normalizeQueryRows(apiName, result).length;
}
