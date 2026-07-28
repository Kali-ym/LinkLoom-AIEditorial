import type { StreamEvent } from '../services/streaming/streamEvent';
import type { ToolPayload } from '../domain/types/tool';
import { TOOLSET_IDS } from '../domain/constants/toolsetIdentifiers';
import { resolveLinkLoomToolIdentity } from '../adapters/api/mappers/toolIdentityMapper';

/** Mock admin tool handler results — shape aligned with backend tool handlers (`{ ok, ... }`). */
export const MOCK_ADMIN_TOOL_RESULTS: Record<string, unknown> = {
  list_schedules: {
    ok: true,
    count: 2,
    items: [
      {
        id: 's1',
        name: '每日采集',
        type: 'INGESTION',
        cronExpr: '0 6 * * *',
        targetId: 'all',
        enabled: true,
      },
      {
        id: 's2',
        name: '评分管线',
        type: 'WORKFLOW',
        cronExpr: '0 8 * * *',
        targetId: 'feed_scoring_pipeline_workflow',
        enabled: false,
      },
    ],
  },
  list_unevaluated_news: {
    ok: true,
    total: 47,
    sampleCount: 3,
    items: [
      { id: 'n1', title: 'AI 新模型发布', source: 'hackernews', published_date: '2026-06-29' },
      { id: 'n2', title: '开源框架更新', source: 'github', published_date: '2026-06-29' },
      { id: 'n3', title: '行业动态', source: 'techcrunch', published_date: '2026-06-29' },
    ],
  },
  create_cron: {
    ok: true,
    schedule: {
      id: 's3',
      name: '每日新闻生产',
      type: 'WORKFLOW',
      cronExpr: '0 8 * * *',
      targetId: 'wf_news_production_chain',
      enabled: true,
      createdAt: '2026-06-29T10:00:00Z',
    },
  },
  trigger_scoring: {
    ok: true,
    workflowId: 'feed_scoring_pipeline_workflow',
    runId: 'wr_mock_1',
    status: 'running',
    hint: '进度可调 list_workflow_runs,结果在 /selection 查看',
  },
  generate_daily_report: {
    ok: true,
    workflowId: 'ai-daily-report-json-from-summary',
    date: '2026-06-29',
    runId: 'wr_mock_2',
    status: 'running',
    hint: '进度可调 list_workflow_runs,结果在 /generation 查看',
  },
  publish_report: {
    ok: true,
    contentId: '5',
    date: '2026-06-29',
    results: [
      { channel: 'local_site', ok: true },
      { channel: 'wechat', ok: true },
    ],
    hint: '可在 /history 查看发布记录',
  },
  update_news_score: {
    ok: true,
    newsId: 'n1',
    title: 'AI 新模型发布',
    oldScore: 70,
    newScore: null,
  },
  decide_workflow_step: {
    ok: true,
    runId: 'r1',
    stepId: 's1',
    decision: 'approve',
    result: { ok: true, status: 'approved' },
  },
  delete_cron: {
    ok: true,
    scheduleId: 's1',
    deleted: true,
  },
  update_cron: {
    ok: true,
    schedule: {
      id: 's1',
      name: '每日采集',
      type: 'INGESTION',
      cronExpr: '0 7 * * *',
      targetId: 'all',
      enabled: true,
    },
  },
  run_schedule_now: {
    ok: true,
    scheduleId: 's1',
    status: 'triggered',
  },
  run_workflow: {
    ok: true,
    workflowId: 'wf_news_production_chain',
    runId: 'wr_mock_3',
    status: 'running',
  },
  delete_news: {
    ok: true,
    newsId: 'n1',
    title: 'AI 新模型发布',
  },
  get_system_stats: {
    ok: true,
    stats: { total: 1200, scored: 980 },
    adapterCount: 5,
    scheduleCount: 2,
  },
  list_recent_reports: {
    ok: true,
    count: 2,
    items: [{ date: '2026-06-29' }, { date: '2026-06-28' }],
  },
  list_task_logs: {
    ok: true,
    count: 2,
    items: [
      {
        id: 'log1',
        taskId: 's1',
        taskName: '每日采集',
        startTime: '2026-06-29T06:00:00Z',
        endTime: '2026-06-29T06:05:00Z',
        status: 'success',
        message: '采集完成',
      },
      {
        id: 'log2',
        taskId: 's2',
        taskName: '评分管线',
        startTime: '2026-06-29T08:00:00Z',
        endTime: '2026-06-29T08:12:00Z',
        status: 'failed',
        message: '超时',
      },
    ],
  },
  get_schedule_detail: {
    ok: true,
    schedule: {
      id: 's1',
      name: '每日采集',
      type: 'INGESTION',
      cronExpr: '0 6 * * *',
      targetId: 'all',
      enabled: true,
    },
  },
  get_adapter_config: {
    ok: true,
    name: 'hackernews',
    status: 'idle',
    lastRun: '2026-06-29T06:05:00Z',
    config: { name: 'hackernews', enabled: true },
  },
  sync_adapter: {
    ok: true,
    adapterName: 'hackernews',
    message: '同步已触发',
  },
  clear_adapter_data: {
    ok: true,
    adapterName: 'hackernews',
  },
  list_processed_news: {
    ok: true,
    count: 2,
    items: [
      {
        id: 'n1',
        title: 'AI 新模型发布',
        score: 85,
        topic: 'model',
        source: 'hackernews',
        published_date: '2026-06-29',
      },
      {
        id: 'n2',
        title: '开源框架更新',
        score: 72,
        topic: 'product',
        source: 'github',
        published_date: '2026-06-29',
      },
    ],
  },
  get_selection_stats: {
    ok: true,
    stats: {
      raw: 12,
      processed24h: 8,
      failed24h: 0,
      passRate24h: 100,
      lastDigestAt: '2026-06-29T12:00:00Z',
    },
  },
  query_continuation_report: {
    ok: true,
    asOfDate: '2026-06-29',
    lookbackDays: 7,
    summary: '近 7 日已发布 3 个主题、12 个 URL；本批命中 3 条历史关联。',
    matches: [
      {
        suggestion: 'continuation',
        prior_headline: '大模型推理优化',
        prior_date: '2026-06-28',
        score: 0.92,
      },
      {
        suggestion: 'drop',
        prior_headline: '重复行业快讯',
        prior_date: '2026-06-27',
        score: 0.98,
      },
      {
        suggestion: 'new_angle',
        prior_headline: '新开源 Agent 框架',
        prior_date: '2026-06-26',
      },
    ],
  },
  get_daily_report_json: {
    ok: true,
    date: '2026-06-29',
    report: {
      title: 'AI 日报 2026-06-29',
      summary: '今日共收录 12 条 AI 相关要闻',
      storyCount: 12,
      stories: Array.from({ length: 12 }, (_, i) => ({ id: `s${i + 1}`, title: `故事 ${i + 1}` })),
    },
  },
  list_report_json_dates: {
    ok: true,
    dates: [
      { date: '2026-06-29', storyCount: 12 },
      { date: '2026-06-28', storyCount: 10 },
      { date: '2026-06-27', storyCount: 8 },
    ],
  },
  get_digest_context: {
    ok: true,
    context: { hotTopics: 5, sourceMonitor: 3, topicTrack: 2 },
  },
  refresh_digest_context: {
    ok: true,
    triggered: ['sched_hot_topics_digest', 'sched_source_monitor_digest'],
  },
  get_aggregated_content: {
    ok: true,
    date: '2026-06-29',
    count: 24,
    items: [{ id: 'a1', title: '聚合素材 1' }, { id: 'a2', title: '聚合素材 2' }],
  },
  get_workflow_run_detail: {
    ok: true,
    run: {
      id: 'wr_mock_detail',
      workflowId: 'ai-daily-report-json-from-summary',
      status: 'completed',
      steps: [
        { id: 'step1', status: 'completed' },
        { id: 'step2', status: 'completed' },
      ],
    },
  },
  get_workflow_run: {
    ok: true,
    run: {
      id: 'wr_mock_run',
      workflowId: 'feed_scoring_pipeline_workflow',
      status: 'running',
      steps: [{ id: 'step1', status: 'pending_approval' }],
    },
  },
  list_pending_approvals: {
    ok: true,
    count: 2,
    items: [
      { runId: 'r1', stepId: 's1', toolName: 'publish_to_wechat', status: 'pending' },
      { runId: 'r2', stepId: 's2', toolName: 'decide_workflow_step', status: 'pending' },
    ],
  },
  get_platform_status: {
    ok: true,
    newsPipeline: { status: 'healthy', lastRun: '2026-06-29T08:00:00Z' },
    platformPipelines: { digest: 'ok', scoring: 'ok' },
  },
  get_governance_status: {
    ok: true,
    governance: { policies: 12, violations: 0, lastAudit: '2026-06-29T06:00:00Z' },
  },
  get_agent_metrics: {
    ok: true,
    metrics: { sessions24h: 48, toolCalls24h: 320, avgLatencyMs: 420 },
  },
  get_commit_history: {
    ok: true,
    total: 3,
    commits: [
      { id: 'h1', date: '2026-06-29', platform: 'wechat', title: 'AI 日报 2026-06-29' },
      { id: 'h2', date: '2026-06-28', platform: 'local_site', title: 'AI 日报 2026-06-28' },
      { id: 'h3', date: '2026-06-27', platform: 'github', title: 'AI 日报 2026-06-27' },
    ],
  },
  get_publication_items: {
    ok: true,
    items: [
      { id: 'pi1', title: '微信文章', channel: 'wechat', status: 'published' },
      { id: 'pi2', title: '站点页面', channel: 'local_site', status: 'published' },
    ],
  },
  republish_report: {
    ok: true,
    id: 'h1',
    date: '2026-06-29',
    results: [
      { channel: 'wechat', ok: true },
      { channel: 'local_site', ok: true },
    ],
  },
  delete_commit_history: {
    ok: true,
  },
  list_agents: {
    ok: true,
    count: 2,
    items: [
      {
        id: 'topic_copilot',
        name: '选题助手',
        description: '新闻选题与评分',
        category: 'editorial',
        toolCount: 8,
      },
      {
        id: 'super_admin',
        name: '超级管理员',
        description: '平台运维与配置',
        category: 'admin',
        toolCount: 58,
      },
    ],
  },
  get_agent: {
    ok: true,
    agent: {
      id: 'topic_copilot',
      name: '选题助手',
      description: '新闻选题与评分',
      category: 'editorial',
      toolIds: ['query_knowledge', 'list_unevaluated_news', 'trigger_scoring'],
    },
  },
  list_skills: {
    ok: true,
    count: 2,
    skills: [
      { id: 'skill_web_search', name: 'Web Search' },
      { id: 'skill_editorial', name: 'Editorial' },
    ],
  },
  scan_skills: {
    ok: true,
    status: 'success',
    added: 1,
    updated: 0,
  },
  list_tools: {
    ok: true,
    count: 3,
    items: [
      { id: 'query_knowledge', name: 'query_knowledge', description: '检索知识库' },
      { id: 'web_search', name: 'web_search', description: '网页搜索' },
      { id: 'list_agents', name: 'list_agents', description: '列出智能体' },
    ],
  },
  list_mcp_configs: {
    ok: true,
    count: 1,
    configs: [{ id: 'linear', name: 'Linear MCP' }],
  },
  test_mcp: {
    ok: true,
    mcpId: 'linear',
    result: { healthy: true },
  },
  list_workflow_templates: {
    ok: true,
    count: 1,
    templates: [
      {
        id: 'tpl_editorial',
        name: '编辑部模板',
        description: '选题+生成+发布',
        agentCount: 3,
        workflowCount: 2,
      },
    ],
  },
  list_agent_bindings: {
    ok: true,
    agentId: 'topic_copilot',
    bindings: [
      { id: 'bind_kb_1', resourceType: 'kb_category' },
      { id: 'bind_mem_1', resourceType: 'memory_category' },
    ],
  },
  list_kb_categories: {
    ok: true,
    count: 2,
    categories: [
      { id: 'cat_editorial', name: '编辑部知识' },
      { id: 'cat_product', name: '产品文档' },
    ],
  },
  list_kb_documents: {
    ok: true,
    categoryId: 'cat_editorial',
    count: 2,
    documents: [
      { id: 'doc_1', name: '选题规范' },
      { id: 'doc_2', name: '评分指南' },
    ],
  },
  get_kb_content: {
    ok: true,
    documentId: 'doc_1',
    content:
      '选题规范：优先覆盖 AI 基础设施、开源框架与行业政策。\n\n评分维度包括时效性、独家性与读者价值。',
  },
  list_memory_categories: {
    ok: true,
    count: 1,
    categories: [{ id: 'mem_pref', name: '用户偏好' }],
  },
  get_rag_status: {
    ok: true,
    status: { readiness: 'hybrid_ready', runtimeMode: 'hybrid', indexedDocs: 128 },
  },
  list_plugin_metadata: {
    ok: true,
    count: 2,
    plugins: [
      { id: 'linkloom-knowledge-base', name: 'Knowledge Base' },
      { id: 'linkloom-admin', name: 'Admin' },
    ],
  },
  save_agent: {
    ok: true,
    agentId: 'topic_copilot',
    agent: {
      id: 'topic_copilot',
      name: '选题助手',
      category: 'editorial',
      toolIds: ['query_knowledge', 'list_unevaluated_news'],
    },
  },
  delete_agent: {
    ok: true,
    agentId: 'old_agent',
  },
  save_workflow: {
    ok: true,
    workflowId: 'wf_news_production_chain',
    workflow: {
      id: 'wf_news_production_chain',
      name: '新闻生产链',
      steps: [{ id: 'step1', toolName: 'trigger_scoring' }],
    },
  },
  instantiate_template: {
    ok: true,
    templateId: 'tpl_editorial',
    createdAgents: ['agent_from_tpl'],
    createdWorkflows: ['wf_from_tpl'],
  },
  get_settings: {
    ok: true,
    settings: {
      ACTIVE_AI_PROVIDER_ID: 'p1',
      AI_PROVIDERS: [{ id: 'p1', type: 'OPENAI', apiKey: 'sk-****' }],
    },
  },
  update_settings: {
    ok: true,
    status: 'success',
  },
  test_ai_provider: {
    ok: true,
    message: '连接正常',
    result: { status: 'success' },
  },
  create_api_key: {
    ok: true,
    id: 'key1',
    key: 'sk_pf_abcdefghijklmnop',
    message: 'sk_pf_abcd...mnop（仅显示一次，请妥善保存）',
  },
  create_kb_category: {
    ok: true,
    id: 'cat_new',
    name: '新分类',
  },
  delete_kb_document: {
    ok: true,
    documentId: 'doc_1',
  },
  batch_reset_scoring: {
    ok: true,
    total: 2,
    succeededCount: 2,
    failedCount: 0,
    succeeded: [{ newsId: 'n1' }, { newsId: 'n2' }],
    failed: [],
  },
  backfill_publication_items: {
    ok: true,
    processed: 3,
    created: 2,
    skipped: 1,
    dryRun: false,
  },
};

const ADMIN_API_NAME_TO_MOCK_KEY: Record<string, string> = {
  createCron: 'create_cron',
  updateCron: 'update_cron',
  deleteCron: 'delete_cron',
  runScheduleNow: 'run_schedule_now',
  runWorkflow: 'run_workflow',
  triggerScoring: 'trigger_scoring',
  decideWorkflowStep: 'decide_workflow_step',
  updateNewsScore: 'update_news_score',
  deleteNews: 'delete_news',
  generateDailyReport: 'generate_daily_report',
  publishReport: 'publish_report',
  syncAdapter: 'sync_adapter',
  clearAdapterData: 'clear_adapter_data',
  refreshDigestContext: 'refresh_digest_context',
  republishReport: 'republish_report',
  deleteCommitHistory: 'delete_commit_history',
  saveAgent: 'save_agent',
  deleteAgent: 'delete_agent',
  saveWorkflow: 'save_workflow',
  instantiateTemplate: 'instantiate_template',
  updateSettings: 'update_settings',
  testAiProvider: 'test_ai_provider',
  createApiKey: 'create_api_key',
  createKbCategory: 'create_kb_category',
  deleteKbDocument: 'delete_kb_document',
  batchResetScoring: 'batch_reset_scoring',
  backfillPublicationItems: 'backfill_publication_items',
};

/** Mock-mode: after HITL approve, attach admin tool success payload for Render cards. */
export function applyMockAdminToolSuccess(tool: ToolPayload): ToolPayload | null {
  if (tool.plugin !== TOOLSET_IDS.ADMIN && tool.identifier !== TOOLSET_IDS.ADMIN) return null;
  const mockKey = tool.linkloomToolId ?? ADMIN_API_NAME_TO_MOCK_KEY[tool.apiName ?? ''];
  if (!mockKey) return null;
  const result = MOCK_ADMIN_TOOL_RESULTS[mockKey];
  if (!result) return null;
  return {
    ...tool,
    intervention: { status: 'resolved' },
    state: 'success',
    pluginState: result,
    resultText: JSON.stringify(result),
    duration: tool.duration ?? '0.4',
  };
}

export function buildAdminMockToolPayload(
  toolName: string,
  overrides: Partial<ToolPayload> = {},
): ToolPayload {
  const identity = resolveLinkLoomToolIdentity({ toolName });
  const result = MOCK_ADMIN_TOOL_RESULTS[toolName];
  return {
    plugin: TOOLSET_IDS.ADMIN,
    identifier: identity.identifier,
    api: identity.apiName,
    apiName: identity.apiName,
    linkloomToolId: identity.linkloomToolId,
    params: (overrides.params ?? overrides.arguments ?? {}) as Record<string, unknown>,
    state: 'success',
    duration: '0.4',
    pluginState: result,
    resultText: result && typeof result === 'object' && 'ok' in (result as object)
      ? JSON.stringify(result)
      : undefined,
    ...overrides,
  };
}

/**
 * Super-admin mock stream: keyword → admin tool showcase events.
 * Returns null when the user message is not an admin demo intent.
 */
export function buildAdminMockStreamEvents(userText: string): StreamEvent[] | null {
  const trimmed = userText.trim();
  if (!trimmed) return null;

  if (/给.*未评分.*评分|触发.*评分管线/.test(trimmed)) {
    const listResult = MOCK_ADMIN_TOOL_RESULTS.list_unevaluated_news as { total: number };
    return [
      { type: 'reasoning_part', content: '先统计未评分新闻，再准备触发评分管线。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('list_unevaluated_news', {
            state: 'success',
            toolCallId: 'tc_list_unevaluated_news',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `当前有 **${listResult.total}** 条未评分新闻，确认后将触发评分管线。`,
      },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('trigger_scoring', {
            state: 'pending',
            toolCallId: 'tc_trigger_scoring',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '请在下方确认触发评分管线。' },
      { type: 'stop' },
    ];
  }

  if (/删除.*定时|delete_cron/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '准备删除定时任务，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('delete_cron', {
            state: 'pending',
            params: { scheduleId: 's1' },
            arguments: { scheduleId: 's1' },
            toolCallId: 'tc_delete_cron',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将删除定时任务 s1，此操作不可撤销，请确认。' },
      { type: 'stop' },
    ];
  }

  if (/发布.*日报|publish_report/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '准备发布日报，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('publish_report', {
            state: 'pending',
            params: { contentId: '5', channels: ['local_site', 'wechat'], date: '2026-06-29' },
            arguments: { contentId: '5', channels: ['local_site', 'wechat'], date: '2026-06-29' },
            toolCallId: 'tc_publish_report',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将发布今日日报到选定渠道，请确认。' },
      { type: 'stop' },
    ];
  }

  if (/未评分|有多少/.test(trimmed) && !/给.*评分|触发/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.list_unevaluated_news as { total: number };
    return [
      { type: 'reasoning_part', content: '先查询未评分新闻数量。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('list_unevaluated_news', {
            state: 'executing',
            toolCallId: 'tc_list_unevaluated_news',
          }),
        ],
      },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('list_unevaluated_news', {
            state: 'success',
            toolCallId: 'tc_list_unevaluated_news',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `当前有 **${result.total}** 条未评分新闻。可在素材运维页查看详情。`,
      },
      { type: 'stop' },
    ];
  }

  if (/定时任务|create_cron|创建定时/.test(trimmed)) {
    const params = {
      name: '每日新闻生产',
      type: 'WORKFLOW',
      cronExpr: '0 8 * * *',
      targetId: 'wf_news_production_chain',
      enabled: true,
    };
    return [
      { type: 'reasoning_part', content: '准备创建定时任务，等待你确认参数。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('create_cron', {
            state: 'pending',
            params,
            arguments: params,
            toolCallId: 'tc_create_cron',
            intervention: { status: 'pending' },
          }),
        ],
      },
      {
        type: 'content_part',
        content: '将创建定时任务「每日新闻生产」，请在下方确认后执行。',
      },
      { type: 'stop' },
    ];
  }

  if (/触发评分|trigger_scoring/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '触发新闻评分管线。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('trigger_scoring', {
            state: 'executing',
            toolCallId: 'tc_trigger_scoring',
          }),
        ],
      },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('trigger_scoring', {
            state: 'success',
            toolCallId: 'tc_trigger_scoring',
          }),
        ],
      },
      { type: 'content_part', content: '评分管线已启动，可在 /ops 查看进度。' },
      { type: 'stop' },
    ];
  }

  if (/任务日志|list_task_logs/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.list_task_logs as { count: number };
    return [
      { type: 'reasoning_part', content: '查询任务运行日志。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('list_task_logs', {
            state: 'success',
            toolCallId: 'tc_list_task_logs',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `共 **${result.count}** 条任务日志，可在调度中心查看详情。`,
      },
      { type: 'stop' },
    ];
  }

  if (/续报|query_continuation_report/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.query_continuation_report as { matches: unknown[] };
    return [
      { type: 'reasoning_part', content: '查询续报覆盖报告。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('query_continuation_report', {
            state: 'success',
            toolCallId: 'tc_query_continuation_report',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `续报报告已生成，共 **${result.matches.length}** 条历史关联。`,
      },
      { type: 'stop' },
    ];
  }

  if (/同步适配器|sync_adapter/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '准备同步适配器，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('sync_adapter', {
            state: 'pending',
            params: { adapterName: 'hackernews' },
            arguments: { adapterName: 'hackernews' },
            toolCallId: 'tc_sync_adapter',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将同步适配器 hackernews，请在下方确认。' },
      { type: 'stop' },
    ];
  }

  if (/清理适配器|clear_adapter_data/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '准备清理适配器数据，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('clear_adapter_data', {
            state: 'pending',
            params: { adapterName: 'hackernews' },
            arguments: { adapterName: 'hackernews' },
            toolCallId: 'tc_clear_adapter_data',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将清理适配器 hackernews 的数据，此操作不可撤销，请确认。' },
      { type: 'stop' },
    ];
  }

  if (/预览日报|get_daily_report_json/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.get_daily_report_json as {
      date: string;
      report: { storyCount: number };
    };
    return [
      { type: 'reasoning_part', content: '查询今日 JSON 日报预览。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('get_daily_report_json', {
            state: 'success',
            toolCallId: 'tc_get_daily_report_json',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `**${result.date}** 日报共 **${result.report.storyCount}** 条故事，可在生成页查看详情。`,
      },
      { type: 'stop' },
    ];
  }

  if (/待审批|list_pending_approvals/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.list_pending_approvals as { count: number };
    return [
      { type: 'reasoning_part', content: '查询待审批工作流步骤。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('list_pending_approvals', {
            state: 'success',
            toolCallId: 'tc_list_pending_approvals',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `当前有 **${result.count}** 条待审批步骤，可在运维中心处理。`,
      },
      { type: 'stop' },
    ];
  }

  if (/发布历史|get_commit_history/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.get_commit_history as { total: number };
    return [
      { type: 'reasoning_part', content: '查询发布历史记录。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('get_commit_history', {
            state: 'success',
            toolCallId: 'tc_get_commit_history',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `共 **${result.total}** 条发布历史，可在历史页查看详情。`,
      },
      { type: 'stop' },
    ];
  }

  if (/重新发布|republish_report/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '准备重新发布历史日报，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('republish_report', {
            state: 'pending',
            params: { id: 'h1' },
            arguments: { id: 'h1' },
            toolCallId: 'tc_republish_report',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将根据历史记录 h1 重新发布到原渠道，请确认。' },
      { type: 'stop' },
    ];
  }

  if (/列出智能体|list_agents/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.list_agents as { count: number };
    return [
      { type: 'reasoning_part', content: '查询平台智能体目录。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('list_agents', {
            state: 'success',
            toolCallId: 'tc_list_agents',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `共 **${result.count}** 个可见智能体，可在智能体页面查看详情。`,
      },
      { type: 'stop' },
    ];
  }

  if (/知识库分类|list_kb_categories/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.list_kb_categories as { count: number };
    return [
      { type: 'reasoning_part', content: '查询知识库分类目录。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('list_kb_categories', {
            state: 'success',
            toolCallId: 'tc_list_kb_categories',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `共 **${result.count}** 个知识库分类，可在知识库页面浏览文档。`,
      },
      { type: 'stop' },
    ];
  }

  if (/MCP连接|test_mcp|MCP.*测试/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.test_mcp as { mcpId: string };
    return [
      { type: 'reasoning_part', content: '测试 MCP 服务器连接。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('test_mcp', {
            state: 'success',
            params: { mcpId: result.mcpId },
            arguments: { mcpId: result.mcpId },
            toolCallId: 'tc_test_mcp',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `MCP **${result.mcpId}** 连接测试完成，可在设置页查看配置。`,
      },
      { type: 'stop' },
    ];
  }

  if (/修改设置|update_settings/.test(trimmed)) {
    const patch = { ACTIVE_AI_PROVIDER_ID: 'p2' };
    return [
      { type: 'reasoning_part', content: '准备修改系统设置，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('update_settings', {
            state: 'pending',
            params: { patch },
            arguments: { patch },
            toolCallId: 'tc_update_settings',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将修改系统设置，此操作不可撤销，请确认 patch 内容。' },
      { type: 'stop' },
    ];
  }

  if (/删除智能体|delete_agent/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '准备删除智能体，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('delete_agent', {
            state: 'pending',
            params: { agentId: 'old_agent' },
            arguments: { agentId: 'old_agent' },
            toolCallId: 'tc_delete_agent',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将删除智能体 old_agent，此操作不可撤销，请确认。' },
      { type: 'stop' },
    ];
  }

  if (/批量重置评分|batch_reset_scoring/.test(trimmed)) {
    return [
      { type: 'reasoning_part', content: '准备批量重置新闻评分，等待确认。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('batch_reset_scoring', {
            state: 'pending',
            params: { newsIds: ['n1', 'n2'] },
            arguments: { newsIds: ['n1', 'n2'] },
            toolCallId: 'tc_batch_reset_scoring',
            intervention: { status: 'pending' },
          }),
        ],
      },
      { type: 'content_part', content: '将重置 2 条新闻的评分，请在下方确认。' },
      { type: 'stop' },
    ];
  }

  if (/系统设置|get_settings/.test(trimmed)) {
    const result = MOCK_ADMIN_TOOL_RESULTS.get_settings as { settings: Record<string, unknown> };
    const keyCount = Object.keys(result.settings).length;
    return [
      { type: 'reasoning_part', content: '查询当前系统设置。', block: 1 },
      { type: 'reasoning', block: 1 },
      {
        type: 'tool_calls',
        tools: [
          buildAdminMockToolPayload('get_settings', {
            state: 'success',
            toolCallId: 'tc_get_settings',
          }),
        ],
      },
      {
        type: 'content_part',
        content: `已读取 **${keyCount}** 项系统设置（敏感字段已脱敏），可在设置页查看详情。`,
      },
      { type: 'stop' },
    ];
  }

  return null;
}
