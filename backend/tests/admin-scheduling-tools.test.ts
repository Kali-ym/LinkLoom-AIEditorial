import { describe, expect, it, vi } from 'vitest';
import { schedulingTools } from '../src/plugins/builtin/tools/admin/schedulingTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

function ctx(overrides: Record<string, unknown> = {}): ToolExecutionContext {
  return {
    store: {
      listTaskLogs: vi.fn().mockResolvedValue([
        {
          id: 1,
          taskId: 'sched_1',
          taskName: '每日采集',
          startTime: '2026-06-29T08:00:00Z',
          endTime: '2026-06-29T08:01:00Z',
          status: 'success',
          message: 'done',
        },
      ]),
      getSchedule: vi.fn().mockResolvedValue({
        id: 'sched_1',
        name: '每日采集',
        type: 'INGESTION',
        cronExpr: '0 6 * * *',
        targetId: 'hackernews',
        enabled: true,
      }),
    },
    settings: {
      ADAPTERS: [
        {
          id: 'hn-1',
          name: 'hackernews',
          adapterType: 'RSSAdapter',
          enabled: true,
          apiUrl: 'https://example.com',
          items: [],
        },
      ],
    },
    taskService: {
      getAdapterStatus: vi.fn().mockResolvedValue({
        hackernews: { status: 'success', lastActive: '2026-06-29T10:00:00Z' },
      }),
      runSingleAdapterIngestion: vi.fn().mockResolvedValue({ added: 5 }),
      clearAdapterData: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  } as unknown as ToolExecutionContext;
}

describe('admin scheduling tools', () => {
  it('list_task_logs returns mapped logs', async () => {
    const t = schedulingTools.find((x) => x.id === 'list_task_logs')!;
    const c = ctx();
    const r = await t.handler({ limit: 10, offset: 0 }, c);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.items[0]).toMatchObject({
      id: 1,
      taskId: 'sched_1',
      taskName: '每日采集',
      status: 'success',
      message: 'done',
    });
    expect(c.store.listTaskLogs).toHaveBeenCalledWith({ limit: 10, offset: 0, taskId: undefined });
  });

  it('list_task_logs filters by taskId', async () => {
    const t = schedulingTools.find((x) => x.id === 'list_task_logs')!;
    const c = ctx();
    await t.handler({ taskId: 'sched_1' }, c);
    expect(c.store.listTaskLogs).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'sched_1', limit: 50, offset: 0 }),
    );
  });

  it('get_schedule_detail returns schedule', async () => {
    const t = schedulingTools.find((x) => x.id === 'get_schedule_detail')!;
    const r = await t.handler({ scheduleId: 'sched_1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.schedule).toMatchObject({ id: 'sched_1', name: '每日采集' });
  });

  it('get_schedule_detail returns NOT_FOUND when missing', async () => {
    const t = schedulingTools.find((x) => x.id === 'get_schedule_detail')!;
    const c = ctx();
    (c.store.getSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const r = await t.handler({ scheduleId: 'missing' }, c);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('get_adapter_config returns config + status', async () => {
    const t = schedulingTools.find((x) => x.id === 'get_adapter_config')!;
    const r = await t.handler({ adapterName: 'hackernews' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.name).toBe('hackernews');
    expect(r.config).toMatchObject({ id: 'hn-1' });
    expect(r.status).toBe('success');
    expect(r.lastRun).toBe('2026-06-29T10:00:00Z');
  });

  it('get_adapter_config returns NOT_FOUND for unknown adapter', async () => {
    const t = schedulingTools.find((x) => x.id === 'get_adapter_config')!;
    const r = await t.handler({ adapterName: 'unknown' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('sync_adapter triggers ingestion', async () => {
    const t = schedulingTools.find((x) => x.id === 'sync_adapter')!;
    const c = ctx();
    const r = await t.handler({ adapterName: 'hackernews', date: '2026-06-29' }, c);
    expect(r.ok).toBe(true);
    expect(r.message).toBe('同步已触发');
    expect(c.taskService.runSingleAdapterIngestion).toHaveBeenCalledWith('hackernews', '2026-06-29', {});
  });

  it('clear_adapter_data clears data', async () => {
    const t = schedulingTools.find((x) => x.id === 'clear_adapter_data')!;
    const c = ctx();
    const r = await t.handler({ adapterName: 'hackernews' }, c);
    expect(r.ok).toBe(true);
    expect(c.taskService.clearAdapterData).toHaveBeenCalledWith('hackernews', undefined);
  });

  it('read tools have no execution policy', () => {
    for (const id of ['list_task_logs', 'get_schedule_detail', 'get_adapter_config']) {
      expect((schedulingTools.find((x) => x.id === id)! as { execution?: unknown }).execution).toBeUndefined();
    }
  });

  it('write tools declare execution policy', () => {
    expect(
      (schedulingTools.find((x) => x.id === 'sync_adapter')! as { execution: { riskLevel: string } }).execution
        .riskLevel,
    ).toBe('medium');
    expect(
      (schedulingTools.find((x) => x.id === 'clear_adapter_data')! as { execution: { riskLevel: string } }).execution
        .riskLevel,
    ).toBe('high');
  });
});
