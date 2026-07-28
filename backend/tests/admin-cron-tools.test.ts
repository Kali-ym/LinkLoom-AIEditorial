import { describe, expect, it, vi } from 'vitest';
import { cronTools } from '../src/plugins/builtin/tools/admin/cronTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

function ctx(): ToolExecutionContext {
  return {
    store: {
      saveSchedule: vi.fn().mockResolvedValue(undefined),
      getSchedule: vi.fn().mockResolvedValue({
        id: 's1',
        name: '旧',
        type: 'INGESTION',
        cronExpr: '0 6 * * *',
        targetId: 'all',
        enabled: true,
      }),
      deleteSchedule: vi.fn().mockResolvedValue(undefined),
    },
    services: {
      schedulerService: {
        startSchedule: vi.fn(),
        stopSchedule: vi.fn(),
        runNow: vi.fn().mockResolvedValue({ ok: true, logId: 123 }),
      },
    },
  } as unknown as ToolExecutionContext;
}

describe('admin cron tools', () => {
  it('create_cron saves + starts when enabled', async () => {
    const t = cronTools.find((x) => x.id === 'create_cron')!;
    const c = ctx();
    const r = await t.handler(
      { name: '每日采集', type: 'INGESTION', cronExpr: '0 6 * * *', targetId: 'all' },
      c,
    );
    expect(r.ok).toBe(true);
    expect(c.store.saveSchedule).toHaveBeenCalled();
    expect(c.services.schedulerService.startSchedule).toHaveBeenCalled();
  });

  it('create_cron does not start when enabled=false', async () => {
    const t = cronTools.find((x) => x.id === 'create_cron')!;
    const c = ctx();
    await t.handler(
      { name: 'n', type: 'WORKFLOW', cronExpr: '0 8 * * *', targetId: 'wf1', enabled: false },
      c,
    );
    expect(c.services.schedulerService.startSchedule).not.toHaveBeenCalled();
  });

  it('update_cron merges patch and restarts', async () => {
    const t = cronTools.find((x) => x.id === 'update_cron')!;
    const c = ctx();
    const r = await t.handler({ scheduleId: 's1', patch: { cronExpr: '0 7 * * *', enabled: false } }, c);
    expect(r.ok).toBe(true);
    expect(r.schedule.cronExpr).toBe('0 7 * * *');
    expect(r.schedule.enabled).toBe(false);
    expect(c.services.schedulerService.stopSchedule).toHaveBeenCalledWith('s1');
  });

  it('update_cron returns NOT_FOUND when missing', async () => {
    const t = cronTools.find((x) => x.id === 'update_cron')!;
    const c = ctx();
    c.store.getSchedule = vi.fn().mockResolvedValue(null) as typeof c.store.getSchedule;
    const r = await t.handler({ scheduleId: 'missing', patch: { enabled: false } }, c);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('delete_cron stops + deletes', async () => {
    const t = cronTools.find((x) => x.id === 'delete_cron')!;
    const c = ctx();
    const r = await t.handler({ scheduleId: 's1' }, c);
    expect(r.ok).toBe(true);
    expect(c.services.schedulerService.stopSchedule).toHaveBeenCalledWith('s1');
    expect(c.store.deleteSchedule).toHaveBeenCalledWith('s1');
  });

  it('run_schedule_now calls schedulerService.runNow', async () => {
    const t = cronTools.find((x) => x.id === 'run_schedule_now')!;
    const c = ctx();
    const r = await t.handler({ scheduleId: 's1' }, c);
    expect(r.ok).toBe(true);
    expect(c.services.schedulerService.runNow).toHaveBeenCalledWith('s1');
  });

  it('cron write tools declare execution policy with riskLevel', () => {
    expect((cronTools.find((x) => x.id === 'create_cron')! as { execution: { riskLevel: string } }).execution.riskLevel).toBe(
      'medium',
    );
    expect((cronTools.find((x) => x.id === 'delete_cron')! as { execution: { riskLevel: string } }).execution.riskLevel).toBe(
      'high',
    );
    expect((cronTools.find((x) => x.id === 'delete_cron')! as { execution: { readonly: boolean } }).execution.readonly).toBe(
      false,
    );
  });
});
