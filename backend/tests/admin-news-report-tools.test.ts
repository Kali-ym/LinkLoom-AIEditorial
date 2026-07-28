import { describe, expect, it, vi } from 'vitest';
import { newsReportTools } from '../src/plugins/builtin/tools/admin/newsReportTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

function ctx(): ToolExecutionContext {
  return {
    store: {
      updateSourceDataMetadata: vi.fn().mockResolvedValue(undefined),
      getCommitHistoryById: vi.fn().mockResolvedValue({
        id: 5,
        date: '2026-06-29',
        commitMessage: '日报',
        fullContent: '<h1>日报</h1>',
        platform: 'local_site',
      }),
      repositories: {
        sourceData: {
          get: vi.fn().mockResolvedValue({ id: 'n1', title: '新闻1', metadata: { ai_score: 70 } }),
        },
      },
    },
    taskService: {
      deleteSourceData: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue({ media_id: 'm1' }),
    },
    services: {
      workflowOrchestrationService: {
        run: vi.fn().mockResolvedValue({ workflowRunId: 'wr_2', status: 'running' }),
      },
    },
  } as unknown as ToolExecutionContext;
}

describe('admin news+report tools', () => {
  it('update_news_score reset clears score fields', async () => {
    const t = newsReportTools.find((x) => x.id === 'update_news_score')!;
    const c = ctx();
    const r = await t.handler({ newsId: 'n1', action: 'reset' }, c);
    expect(r.ok).toBe(true);
    expect(r.oldScore).toBe(70);
    expect(r.newScore).toBeNull();
    expect(c.store.updateSourceDataMetadata).toHaveBeenCalled();
    const passed = (c.store.updateSourceDataMetadata as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(passed.ai_score).toBeNull();
    expect(passed.ai_scored_at).toBeNull();
  });

  it('update_news_score patch sets score + ai_scored_at', async () => {
    const t = newsReportTools.find((x) => x.id === 'update_news_score')!;
    const c = ctx();
    const r = await t.handler({ newsId: 'n1', action: 'patch', score: 88 }, c);
    expect(r.newScore).toBe(88);
    const passed = (c.store.updateSourceDataMetadata as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(passed.ai_score).toBe(88);
    expect(passed.ai_scored_at).toBeTruthy();
  });

  it('update_news_score patch rejects invalid score', async () => {
    const t = newsReportTools.find((x) => x.id === 'update_news_score')!;
    const r = await t.handler({ newsId: 'n1', action: 'patch', score: 150 }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('INVALID_SCORE');
  });

  it('update_news_score returns NOT_FOUND when missing', async () => {
    const t = newsReportTools.find((x) => x.id === 'update_news_score')!;
    const c = ctx();
    (c.store.repositories.sourceData.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await t.handler({ newsId: 'missing', action: 'reset' }, c);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('delete_news calls taskService.deleteSourceData', async () => {
    const t = newsReportTools.find((x) => x.id === 'delete_news')!;
    const c = ctx();
    const r = await t.handler({ newsId: 'n1' }, c);
    expect(r.ok).toBe(true);
    expect(c.taskService.deleteSourceData).toHaveBeenCalledWith('n1');
  });

  it('generate_daily_report defaults to today + default workflow', async () => {
    const t = newsReportTools.find((x) => x.id === 'generate_daily_report')!;
    const c = ctx();
    const r = await t.handler({}, c);
    expect(r.ok).toBe(true);
    expect(r.workflowId).toBe('ai-daily-report-json-from-summary');
    expect(c.services.workflowOrchestrationService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'ai-daily-report-json-from-summary',
        input: { date: expect.any(String) },
        source: 'api',
      }),
    );
  });

  it('generate_daily_report resolves yesterday', async () => {
    const t = newsReportTools.find((x) => x.id === 'generate_daily_report')!;
    const c = ctx();
    await t.handler({ date: 'yesterday' }, c);
    const passedDate = (c.services.workflowOrchestrationService.run as ReturnType<typeof vi.fn>).mock
      .calls[0][0].input.date;
    expect(passedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('publish_report publishes to default channel from history', async () => {
    const t = newsReportTools.find((x) => x.id === 'publish_report')!;
    const c = ctx();
    const r = await t.handler({ contentId: '5' }, c);
    expect(r.ok).toBe(true);
    expect(r.results).toHaveLength(1);
    expect(c.taskService.publish).toHaveBeenCalledTimes(1);
    expect(c.taskService.publish).toHaveBeenCalledWith(
      'local_site',
      '<h1>日报</h1>',
      expect.objectContaining({ date: '2026-06-29', title: '日报' }),
    );
  });

  it('publish_report respects explicit channels', async () => {
    const t = newsReportTools.find((x) => x.id === 'publish_report')!;
    const c = ctx();
    await t.handler({ contentId: '5', channels: ['local_site', 'wechat'] }, c);
    expect(c.taskService.publish).toHaveBeenCalledTimes(2);
    expect(c.taskService.publish.mock.calls[0][0]).toBe('local_site');
    expect(c.taskService.publish.mock.calls[1][0]).toBe('wechat');
  });

  it('publish_report returns NOT_FOUND when content missing', async () => {
    const t = newsReportTools.find((x) => x.id === 'publish_report')!;
    const c = ctx();
    c.store.getCommitHistoryById = vi.fn().mockResolvedValue(null) as typeof c.store.getCommitHistoryById;
    const r = await t.handler({ contentId: '999' }, c);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('delete_news + publish_report are high risk', () => {
    expect(
      (newsReportTools.find((x) => x.id === 'delete_news')! as { execution: { riskLevel: string } }).execution
        .riskLevel,
    ).toBe('high');
    expect(
      (newsReportTools.find((x) => x.id === 'publish_report')! as { execution: { riskLevel: string } }).execution
        .riskLevel,
    ).toBe('high');
  });
});
