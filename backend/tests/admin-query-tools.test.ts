import { describe, expect, it, vi } from 'vitest';
import { queryTools } from '../src/plugins/builtin/tools/admin/queryTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

function ctx(overrides: Record<string, unknown> = {}): ToolExecutionContext {
  return {
    store: {
      listSchedules: vi.fn().mockResolvedValue([
        { id: 's1', name: '每日采集', type: 'INGESTION', cronExpr: '0 6 * * *', targetId: 'all', enabled: true },
      ]),
      getCommitHistory: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      listWorkflows: vi.fn().mockResolvedValue([{ id: 'wf1', name: '评分管线', description: 'd', steps: [{}, {}] }]),
      repositories: {
        sourceData: {
          list: vi.fn().mockResolvedValue({
            total: 47,
            items: [
              {
                id: 'n1',
                title: 't',
                source: 's',
                published_date: '2026-06-29',
                metadata: { ai_score: 80 },
              },
            ],
          }),
          get: vi.fn().mockResolvedValue({
            id: 'n1',
            title: 't',
            url: 'u',
            source: 's',
            published_date: '2026-06-29',
            description: 'd',
            metadata: { ai_score: 80 },
          }),
        },
      },
    },
    taskService: {
      getAdapterStatus: vi.fn().mockResolvedValue([{ name: 'hackernews', status: 'ok', lastRun: '2026-06-29' }]),
      getStats: vi.fn().mockResolvedValue({ total: 100 }),
      getCommittedDates: vi.fn().mockResolvedValue(['2026-06-28', '2026-06-29']),
    },
    services: {
      workflowRunRegistry: {
        list: vi.fn().mockResolvedValue({ items: [{ runId: 'r1', status: 'running' }], total: 1 }),
      },
    },
    ...overrides,
  } as unknown as ToolExecutionContext;
}

describe('admin query tools', () => {
  it('list_schedules returns mapped schedules', async () => {
    const t = queryTools.find((x) => x.id === 'list_schedules')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.items[0]).toMatchObject({ id: 's1', cronExpr: '0 6 * * *', enabled: true });
  });

  it('list_schedules filters by enabled', async () => {
    const t = queryTools.find((x) => x.id === 'list_schedules')!;
    const r = await t.handler({ enabled: false }, ctx());
    expect(r.items).toHaveLength(0);
  });

  it('list_adapters returns adapter status', async () => {
    const t = queryTools.find((x) => x.id === 'list_adapters')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.items[0]).toMatchObject({ name: 'hackernews' });
  });

  it('list_workflows returns stepCount', async () => {
    const t = queryTools.find((x) => x.id === 'list_workflows')!;
    const r = await t.handler({}, ctx());
    expect(r.items[0]).toMatchObject({ id: 'wf1', stepCount: 2 });
  });

  it('list_unevaluated_news returns total + samples', async () => {
    const t = queryTools.find((x) => x.id === 'list_unevaluated_news')!;
    const c = ctx();
    const r = await t.handler({ limit: 5 }, c);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(47);
    expect(r.sampleCount).toBe(1);
    expect(c.store.repositories.sourceData.list).toHaveBeenCalledWith(
      expect.objectContaining({ hasAiScored: false, limit: 5 }),
    );
  });

  it('list_scored_news maps score from metadata', async () => {
    const t = queryTools.find((x) => x.id === 'list_scored_news')!;
    const r = await t.handler({}, ctx());
    expect(r.items[0]).toMatchObject({ score: 80 });
  });

  it('get_news_item returns NOT_FOUND when missing', async () => {
    const t = queryTools.find((x) => x.id === 'get_news_item')!;
    const c = ctx();
    (c.store.repositories.sourceData.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await t.handler({ id: 'missing' }, c);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('list_workflow_runs returns items', async () => {
    const t = queryTools.find((x) => x.id === 'list_workflow_runs')!;
    const c = ctx();
    const r = await t.handler({ status: 'running' }, c);
    expect(r.ok).toBe(true);
    expect(r.items[0]).toMatchObject({ runId: 'r1' });
    expect(c.services.workflowRunRegistry.list).toHaveBeenCalledWith({ status: 'running' }, 0, 20);
  });

  it('get_system_stats aggregates stats + adapters + schedules', async () => {
    const t = queryTools.find((x) => x.id === 'get_system_stats')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.adapterCount).toBe(1);
    expect(r.scheduleCount).toBe(1);
  });

  it('list_recent_reports returns recent dates', async () => {
    const t = queryTools.find((x) => x.id === 'list_recent_reports')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.items.map((i: { date: string }) => i.date)).toContain('2026-06-29');
  });

  it('query tools have no execution policy (no HITL)', () => {
    for (const t of queryTools) expect((t as { execution?: unknown }).execution).toBeUndefined();
  });
});
