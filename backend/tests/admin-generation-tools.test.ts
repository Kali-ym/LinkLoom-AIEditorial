import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generationTools } from '../src/plugins/builtin/tools/admin/generationTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const {
  mockGetReportJson,
  mockGetReportJsonDates,
  mockGetDigestContext,
  mockGetAggregatedContent,
  mockGetWorkflowRun,
} = vi.hoisted(() => ({
  mockGetReportJson: vi.fn(),
  mockGetReportJsonDates: vi.fn(),
  mockGetDigestContext: vi.fn(),
  mockGetAggregatedContent: vi.fn(),
  mockGetWorkflowRun: vi.fn(),
}));

vi.mock('../src/services/api/FeedRouteService.js', () => ({
  FeedRouteService: class MockFeedRouteService {
    getReportJson = mockGetReportJson;
    getReportJsonDates = mockGetReportJsonDates;
  },
}));

vi.mock('../src/services/editorial/DigestContextService.js', () => ({
  DigestContextService: class MockDigestContextService {
    getDigestContext = mockGetDigestContext;
  },
}));

vi.mock('../src/services/api/ContentRouteService.js', () => ({
  ContentRouteService: class MockContentRouteService {
    getAggregatedContent = mockGetAggregatedContent;
  },
}));

vi.mock('../src/services/api/WorkflowRunService.js', () => ({
  WorkflowRunService: class MockWorkflowRunService {
    getWorkflowRun = mockGetWorkflowRun;
  },
}));

function ctx(overrides: Record<string, unknown> = {}): ToolExecutionContext {
  return {
    store: {
      getSchedule: vi.fn().mockImplementation(async (id: string) =>
        id.startsWith('sched_') ? { id, enabled: true } : null,
      ),
    },
    services: {
      schedulerService: { runNow: vi.fn().mockResolvedValue(undefined) },
    },
    ...overrides,
  } as unknown as ToolExecutionContext;
}

describe('admin generation tools', () => {
  beforeEach(() => {
    mockGetReportJson.mockReset();
    mockGetReportJsonDates.mockReset();
    mockGetDigestContext.mockReset();
    mockGetAggregatedContent.mockReset();
    mockGetWorkflowRun.mockReset();

    mockGetReportJson.mockResolvedValue({ date: '2026-06-29', report: { stories: [] } });
    mockGetReportJsonDates.mockResolvedValue([{ date: '2026-06-29', storyCount: 5 }]);
    mockGetDigestContext.mockResolvedValue({ hotTopics: [], sourceMonitor: [], topicTrack: [] });
    mockGetAggregatedContent.mockResolvedValue({ items: [{ id: 'a1' }], date: '2026-06-29' });
    mockGetWorkflowRun.mockResolvedValue({
      workflowRunId: 'wr_1',
      workflowId: 'wf_daily',
      status: 'succeeded',
      steps: [],
    });
  });

  it('get_daily_report_json returns report', async () => {
    const t = generationTools.find((x) => x.id === 'get_daily_report_json')!;
    const r = await t.handler({ date: '2026-06-29' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.date).toBe('2026-06-29');
    expect(r.report).toEqual({ stories: [] });
    expect(mockGetReportJson).toHaveBeenCalledWith({ date: '2026-06-29' });
  });

  it('get_daily_report_json returns NOT_FOUND when missing', async () => {
    mockGetReportJson.mockResolvedValue(null);
    const t = generationTools.find((x) => x.id === 'get_daily_report_json')!;
    const r = await t.handler({ date: '2026-01-01' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('list_report_json_dates returns dates', async () => {
    const t = generationTools.find((x) => x.id === 'list_report_json_dates')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.dates).toHaveLength(1);
    expect(mockGetReportJsonDates).toHaveBeenCalled();
  });

  it('get_digest_context returns context', async () => {
    const t = generationTools.find((x) => x.id === 'get_digest_context')!;
    const r = await t.handler({ date: '2026-06-29' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.context).toBeTruthy();
    expect(mockGetDigestContext).toHaveBeenCalledWith('2026-06-29');
  });

  it('refresh_digest_context triggers existing schedules', async () => {
    const t = generationTools.find((x) => x.id === 'refresh_digest_context')!;
    const c = ctx();
    const r = await t.handler({}, c);
    expect(r.ok).toBe(true);
    expect(r.triggered).toEqual([
      'sched_hot_topics_digest',
      'sched_source_monitor_digest',
      'sched_topic_track_digest',
    ]);
    expect(c.services.schedulerService.runNow).toHaveBeenCalledTimes(3);
  });

  it('get_aggregated_content delegates to ContentRouteService', async () => {
    const t = generationTools.find((x) => x.id === 'get_aggregated_content')!;
    const r = await t.handler(
      { date: '2026-06-29', rangeFrom: '2026-06-28', rangeTo: '2026-06-29' },
      ctx(),
    );
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(mockGetAggregatedContent).toHaveBeenCalledWith({
      date: '2026-06-29',
      rangeFrom: '2026-06-28',
      rangeTo: '2026-06-29',
    });
  });

  it('get_workflow_run_detail returns run with editorialPlan when present', async () => {
    mockGetWorkflowRun.mockResolvedValue({
      workflowRunId: 'wr_2',
      workflowId: 'wf_daily',
      status: 'succeeded',
      steps: [],
      metadata: { editorialPlan: { topics: [{ title: 'AI' }] } },
    });
    const t = generationTools.find((x) => x.id === 'get_workflow_run_detail')!;
    const r = await t.handler({ runId: 'wr_2' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.run.workflowRunId).toBe('wr_2');
    expect(r.editorialPlan).toEqual({ topics: [{ title: 'AI' }] });
  });

  it('get_workflow_run_detail returns NOT_FOUND on missing run', async () => {
    mockGetWorkflowRun.mockRejectedValue(new Error('Workflow run not found: wr_missing'));
    const t = generationTools.find((x) => x.id === 'get_workflow_run_detail')!;
    const r = await t.handler({ runId: 'wr_missing' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('read tools have no execution policy', () => {
    for (const id of [
      'get_daily_report_json',
      'list_report_json_dates',
      'get_digest_context',
      'get_aggregated_content',
      'get_workflow_run_detail',
    ]) {
      expect((generationTools.find((x) => x.id === id)! as { execution?: unknown }).execution).toBeUndefined();
    }
  });

  it('refresh_digest_context declares medium execution policy', () => {
    expect(
      (generationTools.find((x) => x.id === 'refresh_digest_context')! as { execution: { riskLevel: string } })
        .execution.riskLevel,
    ).toBe('medium');
  });
});
