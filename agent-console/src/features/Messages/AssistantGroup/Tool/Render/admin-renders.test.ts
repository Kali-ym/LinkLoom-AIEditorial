import { describe, expect, it } from 'vitest';

import {
  ADMIN_AGENT_CATALOG_RENDER_API_NAMES,
  ADMIN_AGENT_CUSTOM_RENDER_API_NAMES,
  ADMIN_AGENT_WRITE_RENDER_API_NAMES,
  ADMIN_CRON_RENDER_API_NAMES,
  ADMIN_GENERIC_WRITE_RENDER_API_NAMES,
  ADMIN_GENERATION_CUSTOM_RENDER_API_NAMES,
  ADMIN_GENERATION_WRITE_RENDER_API_NAMES,
  ADMIN_HISTORY_CUSTOM_RENDER_API_NAMES,
  ADMIN_HISTORY_WRITE_RENDER_API_NAMES,
  ADMIN_KNOWLEDGE_BROWSE_RENDER_API_NAMES,
  ADMIN_KNOWLEDGE_CUSTOM_RENDER_API_NAMES,
  ADMIN_KNOWLEDGE_WRITE_RENDER_API_NAMES,
  ADMIN_OPS_DASHBOARD_RENDER_API_NAMES,
  ADMIN_QUERY_RENDER_API_NAMES,
  ADMIN_RENDER_API_NAMES,
  ADMIN_SCHEDULING_WRITE_RENDER_API_NAMES,
  ADMIN_WORKFLOW_RUN_RENDER_API_NAMES,
  formatNewsScoreDisplay,
  getGenericResultCount,
  getWorkflowRunTitle,
  getWorkflowStepDecisionLabel,
  resolveAdminRenderResult,
  shouldShowGenerationResultLink,
  shouldShowSelectionLink,
} from './admin/adminRenderConfig';
import {
  CronCreatedRender,
  GenericAdminResultRender,
  NewsScoreUpdatedRender,
  ReportPublishedRender,
  WorkflowRunStartedRender,
  WorkflowStepDecidedRender,
} from './admin/AdminRenders';
import { AdminQueryResultRender } from './admin/AdminQueryRenders';
import { TaskLogsRender } from './admin/AdminSchedulingRenders';
import {
  ContinuationReportRender,
  SelectionStatsRender,
} from './admin/AdminSelectionRenders';
import {
  RefreshDigestContextRender,
  ReportPreviewRender,
  WorkflowDetailRender,
} from './admin/AdminGenerationRenders';
import { OpsDashboardRender } from './admin/AdminOpsRenders';
import { HistoryCommitRender } from './admin/AdminHistoryRenders';
import {
  AgentBindingsRender,
  AgentCatalogRender,
  AgentDetailRender,
  AgentSavedRender,
  createWorkflowSavedRender,
  McpTestRender,
} from './admin/AdminAgentRenders';
import {
  KbCategoryCreatedRender,
  KbContentRender,
  KnowledgeBrowseRender,
  PluginMetadataRender,
  RagStatusRender,
} from './admin/AdminKnowledgeRenders';
import {
  getQueryRenderLink,
  getQueryResultCount,
  normalizeQueryRows,
} from './admin/adminQueryRenderConfig';
import { getBuiltinRender } from './registryImpl';

describe('admin Render cards', () => {
  it('formatNewsScoreDisplay handles reset and numeric scores', () => {
    expect(formatNewsScoreDisplay(88)).toBe('88');
    expect(formatNewsScoreDisplay(null)).toBe('已清空(将重新评分)');
    expect(formatNewsScoreDisplay(undefined)).toBe('已清空(将重新评分)');
  });

  it('getWorkflowRunTitle distinguishes report vs workflow', () => {
    expect(getWorkflowRunTitle({ workflowId: 'wf1' })).toBe('工作流「wf1」已启动');
    expect(getWorkflowRunTitle({ workflowId: 'ai-daily-report-json-from-summary', date: '2026-06-29' })).toMatch(
      /日报生成已启动/,
    );
  });

  it('workflow link helpers match scoring and report flows', () => {
    expect(shouldShowSelectionLink('feed_scoring_pipeline_workflow')).toBe(true);
    expect(shouldShowSelectionLink('wf1')).toBe(false);
    expect(
      shouldShowGenerationResultLink({
        workflowId: 'ai-daily-report-json-from-summary',
        date: '2026-06-29',
      }),
    ).toBe(true);
  });

  it('getGenericResultCount prefers count/total/items length', () => {
    expect(getGenericResultCount({ count: 8, items: [{ id: '1' }] })).toBe(8);
    expect(getGenericResultCount({ total: 47 })).toBe(47);
    expect(getGenericResultCount({ items: [{ id: '1' }, { id: '2' }] })).toBe(2);
  });

  it('getWorkflowStepDecisionLabel maps approve/reject', () => {
    expect(getWorkflowStepDecisionLabel('approve')).toBe('批准');
    expect(getWorkflowStepDecisionLabel('reject')).toBe('拒绝');
  });

  it('registry config covers all 70 admin apiNames in render groups', () => {
    expect(ADMIN_RENDER_API_NAMES).toHaveLength(70);
    expect(ADMIN_CRON_RENDER_API_NAMES).toHaveLength(4);
    expect(ADMIN_WORKFLOW_RUN_RENDER_API_NAMES).toHaveLength(3);
    expect(ADMIN_SCHEDULING_WRITE_RENDER_API_NAMES).toHaveLength(2);
    expect(ADMIN_GENERATION_WRITE_RENDER_API_NAMES).toHaveLength(1);
    expect(ADMIN_GENERATION_CUSTOM_RENDER_API_NAMES).toHaveLength(2);
    expect(ADMIN_OPS_DASHBOARD_RENDER_API_NAMES).toHaveLength(3);
    expect(ADMIN_HISTORY_WRITE_RENDER_API_NAMES).toHaveLength(2);
    expect(ADMIN_HISTORY_CUSTOM_RENDER_API_NAMES).toHaveLength(1);
    expect(ADMIN_QUERY_RENDER_API_NAMES).toHaveLength(23);
    expect(ADMIN_AGENT_CATALOG_RENDER_API_NAMES).toHaveLength(5);
    expect(ADMIN_AGENT_CUSTOM_RENDER_API_NAMES).toHaveLength(3);
    expect(ADMIN_AGENT_WRITE_RENDER_API_NAMES).toHaveLength(3);
    expect(ADMIN_KNOWLEDGE_BROWSE_RENDER_API_NAMES).toHaveLength(3);
    expect(ADMIN_KNOWLEDGE_CUSTOM_RENDER_API_NAMES).toHaveLength(3);
    expect(ADMIN_KNOWLEDGE_WRITE_RENDER_API_NAMES).toHaveLength(1);
    expect(ADMIN_GENERIC_WRITE_RENDER_API_NAMES).toHaveLength(7);
  });

  it('admin render components are defined for each category', () => {
    expect(CronCreatedRender).toBeTruthy();
    expect(WorkflowRunStartedRender).toBeTruthy();
    expect(NewsScoreUpdatedRender).toBeTruthy();
    expect(ReportPublishedRender).toBeTruthy();
    expect(WorkflowStepDecidedRender).toBeTruthy();
    expect(GenericAdminResultRender).toBeTruthy();
    expect(ReportPreviewRender).toBeTruthy();
    expect(WorkflowDetailRender).toBeTruthy();
    expect(RefreshDigestContextRender).toBeTruthy();
    expect(OpsDashboardRender).toBeTruthy();
    expect(HistoryCommitRender).toBeTruthy();
    expect(AgentCatalogRender).toBeTruthy();
    expect(McpTestRender).toBeTruthy();
    expect(AgentDetailRender).toBeTruthy();
    expect(AgentBindingsRender).toBeTruthy();
    expect(KnowledgeBrowseRender).toBeTruthy();
    expect(KbContentRender).toBeTruthy();
    expect(RagStatusRender).toBeTruthy();
    expect(PluginMetadataRender).toBeTruthy();
    expect(AgentSavedRender).toBeTruthy();
    expect(createWorkflowSavedRender('saveWorkflow')).toBeTruthy();
    expect(KbCategoryCreatedRender).toBeTruthy();
  });

  it('resolveAdminRenderResult prefers pluginState over args', () => {
    expect(
      resolveAdminRenderResult({ ok: false }, { ok: true, total: 47, items: [{ id: 'n1' }] }),
    ).toMatchObject({ ok: true, total: 47 });
  });

  it('getBuiltinRender maps all 70 admin apiNames via registry', () => {
    const expected: Record<string, unknown> = {
      createCron: CronCreatedRender,
      updateCron: CronCreatedRender,
      deleteCron: CronCreatedRender,
      runScheduleNow: CronCreatedRender,
      runWorkflow: WorkflowRunStartedRender,
      triggerScoring: WorkflowRunStartedRender,
      generateDailyReport: WorkflowRunStartedRender,
      updateNewsScore: NewsScoreUpdatedRender,
      deleteNews: GenericAdminResultRender,
      publishReport: ReportPublishedRender,
      decideWorkflowStep: WorkflowStepDecidedRender,
      listTaskLogs: TaskLogsRender,
      getSelectionStats: SelectionStatsRender,
      queryContinuationReport: ContinuationReportRender,
      getDailyReportJson: ReportPreviewRender,
      getWorkflowRunDetail: WorkflowDetailRender,
      refreshDigestContext: RefreshDigestContextRender,
      getCommitHistory: HistoryCommitRender,
      getAgent: AgentDetailRender,
      testMcp: McpTestRender,
      listAgentBindings: AgentBindingsRender,
      getKbContent: KbContentRender,
      getRagStatus: RagStatusRender,
      listPluginMetadata: PluginMetadataRender,
    };
    for (const [apiName, render_] of Object.entries(expected)) {
      expect(getBuiltinRender('linkloom-admin', apiName)).toBe(render_);
    }
    for (const apiName of ADMIN_AGENT_WRITE_RENDER_API_NAMES) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      if (apiName === 'saveAgent') {
        expect(render_).toBe(AgentSavedRender);
      } else {
        expect(render_).not.toBe(GenericAdminResultRender);
      }
    }
    for (const apiName of ADMIN_GENERIC_WRITE_RENDER_API_NAMES) {
      expect(getBuiltinRender('linkloom-admin', apiName)).toBe(GenericAdminResultRender);
    }
    for (const apiName of ADMIN_KNOWLEDGE_WRITE_RENDER_API_NAMES) {
      expect(getBuiltinRender('linkloom-admin', apiName)).toBe(KbCategoryCreatedRender);
    }
    for (const apiName of ADMIN_SCHEDULING_WRITE_RENDER_API_NAMES) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      expect(render_).not.toBe(GenericAdminResultRender);
    }
    for (const apiName of ADMIN_OPS_DASHBOARD_RENDER_API_NAMES) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      expect(render_).not.toBe(GenericAdminResultRender);
    }
    for (const apiName of ADMIN_HISTORY_WRITE_RENDER_API_NAMES) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      expect(render_).not.toBe(GenericAdminResultRender);
    }
    for (const apiName of ADMIN_AGENT_CATALOG_RENDER_API_NAMES) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      expect(render_).not.toBe(GenericAdminResultRender);
    }
    for (const apiName of ADMIN_KNOWLEDGE_BROWSE_RENDER_API_NAMES) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      expect(render_).not.toBe(GenericAdminResultRender);
    }
    const queryOnlyApiNames = ADMIN_QUERY_RENDER_API_NAMES.filter(
      (apiName) =>
        apiName !== 'listTaskLogs' &&
        apiName !== 'getSelectionStats' &&
        apiName !== 'queryContinuationReport',
    );
    for (const apiName of queryOnlyApiNames) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      expect(render_).not.toBe(GenericAdminResultRender);
    }
    expect(getBuiltinRender('linkloom-admin', 'unknownTool')).toBeUndefined();
  });
});

describe('AdminQueryResultRender', () => {
  it('getQueryRenderLink maps listSchedules to /scheduling', () => {
    expect(getQueryRenderLink('listSchedules')).toBe('/scheduling');
    expect(getQueryRenderLink('getSystemStats')).toBe('/ops');
  });

  it('getQueryRenderLink maps phase 3 query tools', () => {
    expect(getQueryRenderLink('scanSkills')).toBe('/agents');
    expect(getQueryRenderLink('listAgents')).toBe('/agents');
    expect(getQueryRenderLink('listKbCategories')).toBe('/knowledge');
    expect(getQueryRenderLink('listPluginMetadata')).toBe('/settings');
    expect(getQueryRenderLink('getSettings')).toBe('/settings');
  });

  it('registry maps query apiNames to dedicated query renders', () => {
    expect(AdminQueryResultRender).toBeTruthy();
    const queryOnlyApiNames = ADMIN_QUERY_RENDER_API_NAMES.filter(
      (apiName) =>
        apiName !== 'listTaskLogs' &&
        apiName !== 'getSelectionStats' &&
        apiName !== 'queryContinuationReport',
    );
    for (const apiName of queryOnlyApiNames) {
      const render_ = getBuiltinRender('linkloom-admin', apiName);
      expect(render_).toBeTruthy();
      expect(render_).not.toBe(GenericAdminResultRender);
    }
  });

  it('normalizeQueryRows handles getSystemStats and getNewsItem', () => {
    const stats = normalizeQueryRows('getSystemStats', {
      ok: true,
      stats: { users: 10, jobs: 5 },
    });
    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({ label: 'users', value: 10 });

    const item = normalizeQueryRows('getNewsItem', {
      ok: true,
      item: { id: 'n1', title: 'News' },
    });
    expect(item).toHaveLength(1);
    expect(item[0]).toMatchObject({ id: 'n1', title: 'News' });
  });

  it('getQueryResultCount uses normalized rows when generic count is zero', () => {
    expect(
      getQueryResultCount('getSystemStats', { ok: true, stats: { users: 10, jobs: 5 } }),
    ).toBe(2);
    expect(getQueryResultCount('getNewsItem', { ok: true, item: { id: 'n1' } })).toBe(1);
  });

  it('getQueryResultCount prefers count/total for list queries', () => {
    expect(getQueryResultCount('listSchedules', { count: 8, items: [{ id: '1' }] })).toBe(8);
    expect(
      getQueryResultCount('listSchedules', { items: [{ id: '1' }, { id: '2' }] }),
    ).toBe(2);
  });

  it('normalizeQueryRows handles phase 2 shapes', () => {
    const commits = normalizeQueryRows('getCommitHistory', {
      ok: true,
      commits: [{ id: 'h1', date: '2026-06-29' }],
      total: 1,
    });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ id: 'h1' });

    const dates = normalizeQueryRows('listReportJsonDates', {
      ok: true,
      dates: [{ date: '2026-06-29', storyCount: 12 }],
    });
    expect(dates).toHaveLength(1);
    expect(dates[0]).toMatchObject({ storyCount: 12 });
  });

  it('getQueryRenderLink maps phase 2 query tools', () => {
    expect(getQueryRenderLink('listPendingApprovals')).toBe('/ops');
    expect(getQueryRenderLink('getCommitHistory')).toBe('/history');
    expect(getQueryRenderLink('listReportJsonDates')).toBe('/generation');
    expect(getQueryRenderLink('getPublicationItems')).toBe('/history');
  });

  it('normalizeQueryRows handles phase 3 list shapes', () => {
    const agents = normalizeQueryRows('listAgents', {
      ok: true,
      items: [{ id: 'a1', name: 'Agent 1', toolCount: 2 }],
    });
    expect(agents).toHaveLength(1);

    const skills = normalizeQueryRows('scanSkills', {
      ok: true,
      status: 'success',
      added: 1,
      updated: 0,
    });
    expect(skills[0]).toMatchObject({ added: 1 });

    const categories = normalizeQueryRows('listKbCategories', {
      ok: true,
      categories: [{ id: 'cat1', name: 'Cat 1' }],
    });
    expect(categories).toHaveLength(1);

    const settings = normalizeQueryRows('getSettings', {
      ok: true,
      settings: { ACTIVE_AI_PROVIDER_ID: 'p1', AI_PROVIDERS: [] },
    });
    expect(settings).toHaveLength(2);
    expect(settings[0]).toMatchObject({ label: 'ACTIVE_AI_PROVIDER_ID' });
  });

  it('normalizeQueryRows handles getScheduleDetail and getAdapterConfig', () => {
    const schedule = normalizeQueryRows('getScheduleDetail', {
      ok: true,
      schedule: { id: 's1', name: '每日采集', cronExpr: '0 6 * * *' },
    });
    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({ name: '每日采集' });

    const adapter = normalizeQueryRows('getAdapterConfig', {
      ok: true,
      name: 'hackernews',
      status: 'idle',
      lastRun: '2026-06-29T06:00:00Z',
    });
    expect(adapter).toHaveLength(1);
    expect(adapter[0]).toMatchObject({ name: 'hackernews', status: 'idle' });
  });
});
