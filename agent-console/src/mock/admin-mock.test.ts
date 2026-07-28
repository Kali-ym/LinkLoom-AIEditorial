import { describe, expect, it } from 'vitest';

import { buildAdminMockStreamEvents, MOCK_ADMIN_TOOL_RESULTS } from '../fixtures/mockAdminTools';
import { buildEventSequence } from '../services/mock/StreamingHandler';
import { MOCK_AGENTS } from './data';

describe('mock super_admin agent', () => {
  it('MOCK_AGENTS includes super_admin with consoleVisible true', () => {
    const agent = MOCK_AGENTS.find((a) => a.id === 'super_admin');
    expect(agent).toBeTruthy();
    expect(agent?.consoleVisible).toBe(true);
    expect(agent?.name).toBe('超级管理员');
    expect(agent?.openingQuestions?.length).toBeGreaterThanOrEqual(4);
  });

  it('super_admin welcome mentions 超级管理员', () => {
    const agent = MOCK_AGENTS.find((a) => a.id === 'super_admin')!;
    expect(agent.welcome).toContain('超级管理员');
  });

  it('MOCK_ADMIN_TOOL_RESULTS includes list_unevaluated_news', () => {
    expect(MOCK_ADMIN_TOOL_RESULTS.list_unevaluated_news).toMatchObject({ ok: true, total: 47 });
  });

  it('buildAdminMockStreamEvents returns tool flow for 未评分 query', () => {
    const events = buildAdminMockStreamEvents('现在有多少未评分新闻？');
    expect(events).not.toBeNull();
    const toolEvents = events!.filter((e) => e.type === 'tool_calls');
    expect(toolEvents.length).toBeGreaterThan(0);
    const apis = toolEvents.flatMap((e) => (e.tools ?? []).map((t) => t.apiName));
    expect(apis).toContain('listUnevaluatedNews');
  });

  it('buildAdminMockStreamEvents returns HITL pending for create cron intent', () => {
    const events = buildAdminMockStreamEvents('帮我创建一个定时任务');
    expect(events).not.toBeNull();
    const tools = events!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : []));
    expect(tools.some((t) => t.apiName === 'createCron' && t.intervention?.status === 'pending')).toBe(
      true,
    );
  });

  it('buildAdminMockStreamEvents supports scoring and high-risk flows', () => {
    const scoring = buildAdminMockStreamEvents('给未评分新闻评分');
    const scoringTools = scoring!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : []));
    expect(scoringTools.some((t) => t.apiName === 'triggerScoring')).toBe(true);

    const deleteCron = buildAdminMockStreamEvents('删除一个定时任务');
    expect(
      deleteCron!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'deleteCron',
      ),
    ).toBe(true);
  });

  it('buildAdminMockStreamEvents returns tool flow for 任务日志 query', () => {
    const events = buildAdminMockStreamEvents('查看任务日志');
    expect(events).not.toBeNull();
    const apis = events!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).map((t) => t.apiName);
    expect(apis).toContain('listTaskLogs');
  });

  it('buildAdminMockStreamEvents supports continuation and adapter flows', () => {
    const continuation = buildAdminMockStreamEvents('查续报报告');
    expect(
      continuation!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'queryContinuationReport',
      ),
    ).toBe(true);

    const sync = buildAdminMockStreamEvents('同步适配器');
    expect(
      sync!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'syncAdapter' && t.intervention?.status === 'pending',
      ),
    ).toBe(true);
  });

  it('buildAdminMockStreamEvents supports phase 2 keywords', () => {
    const preview = buildAdminMockStreamEvents('预览日报');
    expect(
      preview!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'getDailyReportJson',
      ),
    ).toBe(true);

    const pending = buildAdminMockStreamEvents('查看待审批');
    expect(
      pending!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'listPendingApprovals',
      ),
    ).toBe(true);

    const history = buildAdminMockStreamEvents('查发布历史');
    expect(
      history!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'getCommitHistory',
      ),
    ).toBe(true);

    const republish = buildAdminMockStreamEvents('重新发布');
    expect(
      republish!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'republishReport' && t.intervention?.status === 'pending',
      ),
    ).toBe(true);
  });

  it('buildAdminMockStreamEvents supports phase 3 keywords', () => {
    const agents = buildAdminMockStreamEvents('列出智能体');
    expect(
      agents!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'listAgents',
      ),
    ).toBe(true);

    const kb = buildAdminMockStreamEvents('知识库分类');
    expect(
      kb!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'listKbCategories',
      ),
    ).toBe(true);

    const mcp = buildAdminMockStreamEvents('MCP连接');
    expect(
      mcp!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'testMcp',
      ),
    ).toBe(true);
  });

  it('buildAdminMockStreamEvents supports phase 4 keywords', () => {
    const settings = buildAdminMockStreamEvents('修改设置');
    expect(
      settings!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'updateSettings' && t.intervention?.status === 'pending',
      ),
    ).toBe(true);

    const deleteAgent = buildAdminMockStreamEvents('删除智能体');
    expect(
      deleteAgent!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'deleteAgent' && t.intervention?.status === 'pending',
      ),
    ).toBe(true);

    const batchReset = buildAdminMockStreamEvents('批量重置评分');
    expect(
      batchReset!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'batchResetScoring' && t.intervention?.status === 'pending',
      ),
    ).toBe(true);

    const getSettings = buildAdminMockStreamEvents('查看系统设置');
    expect(
      getSettings!.flatMap((e) => (e.type === 'tool_calls' ? e.tools ?? [] : [])).some(
        (t) => t.apiName === 'getSettings' && t.state === 'success',
      ),
    ).toBe(true);
  });

  it('buildEventSequence only uses admin mock stream for super_admin agent', () => {
    const query = '现在有多少未评分新闻？';

    const superAdminEvents = buildEventSequence(query, { agentId: 'super_admin' });
    const superAdminApis = superAdminEvents
      .filter((e) => e.type === 'tool_calls')
      .flatMap((e) => (e.tools ?? []).map((t) => t.apiName));
    expect(superAdminApis).toContain('listUnevaluatedNews');

    const copilotEvents = buildEventSequence(query, { agentId: 'topic_copilot' });
    const copilotApis = copilotEvents
      .filter((e) => e.type === 'tool_calls')
      .flatMap((e) => (e.tools ?? []).map((t) => t.apiName));
    expect(copilotApis).not.toContain('listUnevaluatedNews');
  });
});
