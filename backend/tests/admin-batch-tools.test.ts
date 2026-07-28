import { describe, expect, it, vi, beforeEach } from 'vitest';
import { batchTools } from '../src/plugins/builtin/tools/admin/batchTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const { mockResetScoring, mockBackfillPublicationItems } = vi.hoisted(() => ({
  mockResetScoring: vi.fn(),
  mockBackfillPublicationItems: vi.fn(),
}));

vi.mock('../src/services/api/FeedRouteService.js', () => ({
  FeedRouteService: class MockFeedRouteService {
    resetScoring = mockResetScoring;
  },
}));

vi.mock('../src/services/api/PublishingRouteService.js', () => ({
  PublishingRouteService: class MockPublishingRouteService {
    backfillPublicationItems = mockBackfillPublicationItems;
  },
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {} } as unknown as ToolExecutionContext;
}

describe('admin batch tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetScoring.mockImplementation(async (id: string) => ({
      id,
      changed: true,
      resetKeys: ['ai_score'],
    }));
    mockBackfillPublicationItems.mockResolvedValue({
      processed: 3,
      created: 2,
      skipped: 1,
    });
  });

  it('batch_reset_scoring resets each newsId and returns partial results', async () => {
    mockResetScoring
      .mockResolvedValueOnce({ id: 'n1', changed: true })
      .mockRejectedValueOnce(new Error('source data not found'));

    const t = batchTools.find((x) => x.id === 'batch_reset_scoring')!;
    const r = await t.handler({ newsIds: ['n1', 'n2'] }, ctx());
    expect(r.ok).toBe(false);
    expect(r.total).toBe(2);
    expect(r.succeededCount).toBe(1);
    expect(r.failedCount).toBe(1);
    expect(r.succeeded[0].newsId).toBe('n1');
    expect(r.failed[0].newsId).toBe('n2');
    expect(mockResetScoring).toHaveBeenCalledTimes(2);
  });

  it('batch_reset_scoring returns ok when all succeed', async () => {
    const t = batchTools.find((x) => x.id === 'batch_reset_scoring')!;
    const r = await t.handler({ newsIds: ['n1', 'n2'] }, ctx());
    expect(r.ok).toBe(true);
    expect(r.succeededCount).toBe(2);
    expect(r.failedCount).toBe(0);
  });

  it('batch_reset_scoring has medium execution policy', () => {
    const t = batchTools.find((x) => x.id === 'batch_reset_scoring')!;
    expect(t.execution).toEqual({ readonly: false, riskLevel: 'medium' });
  });

  it('backfill_publication_items calls PublishingRouteService', async () => {
    const t = batchTools.find((x) => x.id === 'backfill_publication_items')!;
    const r = await t.handler({ limit: 10, dryRun: true }, ctx());
    expect(r.ok).toBe(true);
    expect(r.processed).toBe(3);
    expect(r.dryRun).toBe(true);
    expect(mockBackfillPublicationItems).toHaveBeenCalledWith({ limit: 10, dryRun: true });
  });

  it('batchTools has exactly 2 tools', () => {
    expect(batchTools).toHaveLength(2);
  });
});
