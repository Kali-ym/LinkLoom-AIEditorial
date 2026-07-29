import type { ToolExecutionContext } from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { ToolRegistry } from '../../../../registries/ToolRegistry.js';

export type PlatformHttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface PlatformApiOperation {
  method: PlatformHttpMethod;
  /** Path template, e.g. /api/schedules/:id */
  path: string;
  summary: string;
  /** Underlying admin tool id (kept registered for dispatch). */
  toolId: string;
  riskLevel: ToolExecutionPolicy['riskLevel'];
  mapArgs?: (input: {
    params: Record<string, string>;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
  }) => Record<string, unknown>;
}

function matchPath(
  template: string,
  actual: string
): Record<string, string> | null {
  const tParts = template.split('/').filter(Boolean);
  const aParts = actual.split('/').filter(Boolean);
  if (tParts.length !== aParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < tParts.length; i++) {
    const t = tParts[i]!;
    const a = aParts[i]!;
    if (t.startsWith(':')) {
      params[t.slice(1)] = decodeURIComponent(a);
    } else if (t !== a) {
      return null;
    }
  }
  return params;
}

/** Allowlisted platform operations → existing admin tool handlers. */
export const PLATFORM_API_OPERATIONS: PlatformApiOperation[] = [
  // schedules
  {
    method: 'GET',
    path: '/api/schedules',
    summary: '列出定时任务',
    toolId: 'list_schedules',
    riskLevel: 'low',
    mapArgs: ({ query }) => ({ enabled: query.enabled }),
  },
  {
    method: 'GET',
    path: '/api/schedules/:id',
    summary: '获取定时任务详情',
    toolId: 'get_schedule_detail',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ scheduleId: params.id }),
  },
  {
    method: 'POST',
    path: '/api/schedules',
    summary: '创建定时任务',
    toolId: 'create_cron',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'PATCH',
    path: '/api/schedules/:id',
    summary: '更新定时任务',
    toolId: 'update_cron',
    riskLevel: 'medium',
    mapArgs: ({ params, body }) => ({ scheduleId: params.id, patch: body }),
  },
  {
    method: 'DELETE',
    path: '/api/schedules/:id',
    summary: '删除定时任务',
    toolId: 'delete_cron',
    riskLevel: 'high',
    mapArgs: ({ params }) => ({ scheduleId: params.id }),
  },
  {
    method: 'POST',
    path: '/api/schedules/:id/run',
    summary: '立即运行定时任务',
    toolId: 'run_schedule_now',
    riskLevel: 'medium',
    mapArgs: ({ params }) => ({ scheduleId: params.id }),
  },
  {
    method: 'GET',
    path: '/api/schedules/logs',
    summary: '列任务日志',
    toolId: 'list_task_logs',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },

  // adapters / dashboard
  {
    method: 'GET',
    path: '/api/adapters',
    summary: '列采集适配器',
    toolId: 'list_adapters',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/adapters/:name',
    summary: '获取适配器配置',
    toolId: 'get_adapter_config',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ adapterName: params.name }),
  },
  {
    method: 'POST',
    path: '/api/adapters/:name/sync',
    summary: '同步适配器',
    toolId: 'sync_adapter',
    riskLevel: 'medium',
    mapArgs: ({ params, body }) => ({ adapterName: params.name, ...body }),
  },
  {
    method: 'POST',
    path: '/api/adapters/:name/clear',
    summary: '清空适配器数据',
    toolId: 'clear_adapter_data',
    riskLevel: 'high',
    mapArgs: ({ params }) => ({ adapterName: params.name }),
  },

  // workflows
  {
    method: 'GET',
    path: '/api/workflows',
    summary: '列工作流',
    toolId: 'list_workflows',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/workflows/:id/run',
    summary: '运行工作流',
    toolId: 'run_workflow',
    riskLevel: 'medium',
    mapArgs: ({ params, body }) => ({ workflowId: params.id, input: body.input ?? body }),
  },
  {
    method: 'GET',
    path: '/api/workflow-runs',
    summary: '列工作流运行',
    toolId: 'list_workflow_runs',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/workflow-runs/:id',
    summary: '获取工作流运行',
    toolId: 'get_workflow_run',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ runId: params.id }),
  },
  {
    method: 'GET',
    path: '/api/workflow-runs/:id/detail',
    summary: '获取工作流运行详情',
    toolId: 'get_workflow_run_detail',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ runId: params.id }),
  },
  {
    method: 'GET',
    path: '/api/approvals/pending',
    summary: '列待审批步骤',
    toolId: 'list_pending_approvals',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/approvals/decide',
    summary: '审批工作流步骤',
    toolId: 'decide_workflow_step',
    riskLevel: 'high',
    mapArgs: ({ body }) => body,
  },

  // news / feed admin
  {
    method: 'GET',
    path: '/api/feed/admin/unevaluated',
    summary: '列未评分新闻',
    toolId: 'list_unevaluated_news',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/feed/admin/scored',
    summary: '列已评分新闻',
    toolId: 'list_scored_news',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/feed/admin/processed',
    summary: '列已处理新闻',
    toolId: 'list_processed_news',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/feed/admin/news/:id',
    summary: '获取新闻条目',
    toolId: 'get_news_item',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ id: params.id }),
  },
  {
    method: 'PATCH',
    path: '/api/feed/admin/news/:id/score',
    summary: '更新新闻评分',
    toolId: 'update_news_score',
    riskLevel: 'medium',
    mapArgs: ({ params, body }) => ({ id: params.id, ...body }),
  },
  {
    method: 'DELETE',
    path: '/api/feed/admin/news/:id',
    summary: '删除新闻',
    toolId: 'delete_news',
    riskLevel: 'high',
    mapArgs: ({ params }) => ({ id: params.id }),
  },
  {
    method: 'GET',
    path: '/api/feed/admin/selection-stats',
    summary: '选题统计',
    toolId: 'get_selection_stats',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'POST',
    path: '/api/feed/admin/scoring/trigger',
    summary: '触发评分管线',
    toolId: 'trigger_scoring',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'POST',
    path: '/api/feed/admin/scoring/reset',
    summary: '批量重置评分',
    toolId: 'batch_reset_scoring',
    riskLevel: 'high',
    mapArgs: ({ body }) => body,
  },

  // reports
  {
    method: 'GET',
    path: '/api/reports/recent',
    summary: '列最近日报',
    toolId: 'list_recent_reports',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'POST',
    path: '/api/reports/generate',
    summary: '生成日报',
    toolId: 'generate_daily_report',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'POST',
    path: '/api/reports/publish',
    summary: '发布日报',
    toolId: 'publish_report',
    riskLevel: 'high',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'GET',
    path: '/api/reports/json',
    summary: '获取日报 JSON',
    toolId: 'get_daily_report_json',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/reports/json/dates',
    summary: '列日报 JSON 日期',
    toolId: 'list_report_json_dates',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/reports/continuation',
    summary: '查询续报',
    toolId: 'query_continuation_report',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/digest/context',
    summary: '获取 digest 上下文',
    toolId: 'get_digest_context',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'POST',
    path: '/api/digest/context/refresh',
    summary: '刷新 digest 上下文',
    toolId: 'refresh_digest_context',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'GET',
    path: '/api/content/aggregated',
    summary: '获取聚合素材',
    toolId: 'get_aggregated_content',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },

  // ops / stats
  {
    method: 'GET',
    path: '/api/system/stats',
    summary: '系统统计',
    toolId: 'get_system_stats',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/platform/pipelines/status',
    summary: '平台管线状态',
    toolId: 'get_platform_status',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/platform/governance/status',
    summary: '治理状态',
    toolId: 'get_governance_status',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/agents/metrics',
    summary: 'Agent 指标',
    toolId: 'get_agent_metrics',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },

  // history
  {
    method: 'GET',
    path: '/api/history/commits',
    summary: '发布提交历史',
    toolId: 'get_commit_history',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/history/:id/items',
    summary: '发布条目',
    toolId: 'get_publication_items',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ id: params.id }),
  },
  {
    method: 'POST',
    path: '/api/history/republish/:id',
    summary: '重新发布',
    toolId: 'republish_report',
    riskLevel: 'high',
    mapArgs: ({ params, body }) => ({ id: params.id, ...body }),
  },
  {
    method: 'DELETE',
    path: '/api/history/commits/:id',
    summary: '删除提交历史',
    toolId: 'delete_commit_history',
    riskLevel: 'high',
    mapArgs: ({ params }) => ({ id: params.id }),
  },
  {
    method: 'POST',
    path: '/api/history/publication-items/backfill',
    summary: '回填发布条目',
    toolId: 'backfill_publication_items',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },

  // agents / skills / tools / mcp / templates
  {
    method: 'GET',
    path: '/api/agents',
    summary: '列智能体',
    toolId: 'list_agents',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/agents/:id',
    summary: '获取智能体',
    toolId: 'get_agent',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ agentId: params.id }),
  },
  {
    method: 'POST',
    path: '/api/agents',
    summary: '保存智能体',
    toolId: 'save_agent',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'DELETE',
    path: '/api/agents/:id',
    summary: '删除智能体',
    toolId: 'delete_agent',
    riskLevel: 'high',
    mapArgs: ({ params }) => ({ agentId: params.id }),
  },
  {
    method: 'GET',
    path: '/api/skills',
    summary: '列技能',
    toolId: 'list_skills',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/skills/scan',
    summary: '扫描技能',
    toolId: 'scan_skills',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/tools',
    summary: '列工具',
    toolId: 'list_tools',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/mcp-configs',
    summary: '列 MCP 配置',
    toolId: 'list_mcp_configs',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/mcp-configs/:id/test',
    summary: '测试 MCP',
    toolId: 'test_mcp',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ id: params.id }),
  },
  {
    method: 'GET',
    path: '/api/workflow-templates',
    summary: '列工作流模板',
    toolId: 'list_workflow_templates',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/workflow-templates/:id/instantiate',
    summary: '实例化模板',
    toolId: 'instantiate_template',
    riskLevel: 'medium',
    mapArgs: ({ params, body }) => ({ templateId: params.id, ...body }),
  },
  {
    method: 'GET',
    path: '/api/agent-bindings',
    summary: '列 Agent 绑定',
    toolId: 'list_agent_bindings',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/workflows',
    summary: '保存工作流',
    toolId: 'save_workflow',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },

  // knowledge / memory / rag
  {
    method: 'GET',
    path: '/api/kb/categories',
    summary: '列知识库分类',
    toolId: 'list_kb_categories',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/kb/categories',
    summary: '创建知识库分类',
    toolId: 'create_kb_category',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'GET',
    path: '/api/kb/documents',
    summary: '列知识库文档',
    toolId: 'list_kb_documents',
    riskLevel: 'low',
    mapArgs: ({ query }) => query,
  },
  {
    method: 'GET',
    path: '/api/kb/documents/:id',
    summary: '获取知识库文档',
    toolId: 'get_kb_content',
    riskLevel: 'low',
    mapArgs: ({ params }) => ({ id: params.id }),
  },
  {
    method: 'DELETE',
    path: '/api/kb/documents/:id',
    summary: '删除知识库文档',
    toolId: 'delete_kb_document',
    riskLevel: 'high',
    mapArgs: ({ params }) => ({ id: params.id }),
  },
  {
    method: 'GET',
    path: '/api/memory/categories',
    summary: '列记忆分类',
    toolId: 'list_memory_categories',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/rag/status',
    summary: 'RAG 状态',
    toolId: 'get_rag_status',
    riskLevel: 'low',
  },
  {
    method: 'GET',
    path: '/api/plugins/metadata',
    summary: '插件元数据',
    toolId: 'list_plugin_metadata',
    riskLevel: 'low',
  },

  // settings
  {
    method: 'GET',
    path: '/api/settings',
    summary: '获取系统设置',
    toolId: 'get_settings',
    riskLevel: 'low',
  },
  {
    method: 'POST',
    path: '/api/settings',
    summary: '更新系统设置',
    toolId: 'update_settings',
    riskLevel: 'high',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'POST',
    path: '/api/settings/test-ai-provider',
    summary: '测试 AI Provider',
    toolId: 'test_ai_provider',
    riskLevel: 'low',
    mapArgs: ({ body }) => body,
  },
  {
    method: 'POST',
    path: '/api/settings/api-keys',
    summary: '创建 API Key',
    toolId: 'create_api_key',
    riskLevel: 'medium',
    mapArgs: ({ body }) => body,
  },
];

export function discoverPlatformOperations(prefix?: string, limit = 50) {
  const normalized = (prefix || '/api').trim() || '/api';
  const matched = PLATFORM_API_OPERATIONS.filter((op) => op.path.startsWith(normalized));
  return {
    prefix: normalized,
    count: matched.length,
    operations: matched.slice(0, limit).map((op) => ({
      method: op.method,
      path: op.path,
      summary: op.summary,
      riskLevel: op.riskLevel,
    })),
    truncated: matched.length > limit,
  };
}

export function resolvePlatformOperation(
  method: string,
  path: string
): { operation: PlatformApiOperation; params: Record<string, string> } | null {
  const m = method.toUpperCase() as PlatformHttpMethod;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  for (const operation of PLATFORM_API_OPERATIONS) {
    if (operation.method !== m) continue;
    const params = matchPath(operation.path, normalizedPath);
    if (params) return { operation, params };
  }
  return null;
}

export async function invokePlatformOperation(
  input: {
    method: string;
    path: string;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    purpose?: string;
  },
  context: ToolExecutionContext
) {
  const resolved = resolvePlatformOperation(input.method, input.path);
  if (!resolved) {
    return {
      ok: false,
      status: 404,
      errorCode: 'PLATFORM_PATH_NOT_ALLOWED',
      message: `No allowlisted operation for ${input.method.toUpperCase()} ${input.path}`,
      hint: '先调 platform_discover 查看可用 path；写操作优先用专属 SOP 工具(如 create_cron/trigger_scoring)。',
    };
  }

  const { operation, params } = resolved;
  const args = operation.mapArgs
    ? operation.mapArgs({
        params,
        query: input.query ?? {},
        body: input.body ?? {},
      })
    : { ...(input.query ?? {}), ...(input.body ?? {}), ...params };

  const data = await ToolRegistry.getInstance().callTool(operation.toolId, args, context);
  return {
    ok: true,
    status: 200,
    method: operation.method,
    path: operation.path,
    purpose: input.purpose,
    toolId: operation.toolId,
    data,
  };
}
