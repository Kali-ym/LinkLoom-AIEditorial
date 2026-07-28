import { describe, expect, it, vi, beforeEach } from 'vitest';
import { historyTools } from '../src/plugins/builtin/tools/admin/historyTools.js';
import { AppError } from '../src/domain/errors.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const {
  mockListCommitHistory,
  mockListPublicationItems,
  mockRepublish,
  mockDeleteCommitHistory,
} = vi.hoisted(() => ({
  mockListCommitHistory: vi.fn(),
  mockListPublicationItems: vi.fn(),
  mockRepublish: vi.fn(),
  mockDeleteCommitHistory: vi.fn(),
}));

vi.mock('../src/services/api/PublishingRouteService.js', () => ({
  PublishingRouteService: class MockPublishingRouteService {
    listCommitHistory = mockListCommitHistory;
    listPublicationItems = mockListPublicationItems;
    republish = mockRepublish;
    deleteCommitHistory = mockDeleteCommitHistory;
  },
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {} } as unknown as ToolExecutionContext;
}

describe('admin history tools', () => {
  beforeEach(() => {
    mockListCommitHistory.mockReset();
    mockListPublicationItems.mockReset();
    mockRepublish.mockReset();
    mockDeleteCommitHistory.mockReset();

    mockListCommitHistory.mockResolvedValue({
      commits: [{ id: 1, platform: 'wechat', date: '2026-06-29' }],
      total: 1,
    });
    mockListPublicationItems.mockResolvedValue({ items: [{ title: '条目 A' }] });
    mockRepublish.mockResolvedValue({ status: 'success', data: { published: true } });
    mockDeleteCommitHistory.mockResolvedValue({ status: 'success' });
  });

  it('get_commit_history returns commits and total', async () => {
    const t = historyTools.find((x) => x.id === 'get_commit_history')!;
    const r = await t.handler(
      { date: '2026-06-29', platform: 'wechat', limit: 10, offset: 0, search: '日报' },
      ctx(),
    );
    expect(r.ok).toBe(true);
    expect(r.commits).toHaveLength(1);
    expect(r.total).toBe(1);
    expect(mockListCommitHistory).toHaveBeenCalledWith({
      date: '2026-06-29',
      platform: 'wechat',
      limit: 10,
      offset: 0,
      search: '日报',
    });
  });

  it('get_publication_items returns items', async () => {
    const t = historyTools.find((x) => x.id === 'get_publication_items')!;
    const r = await t.handler({ historyId: '42' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(mockListPublicationItems).toHaveBeenCalledWith('42');
  });

  it('get_publication_items handles invalid history id', async () => {
    mockListPublicationItems.mockRejectedValue(new AppError(400, 'Invalid history id'));
    const t = historyTools.find((x) => x.id === 'get_publication_items')!;
    const r = await t.handler({ historyId: 'bad' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('INVALID_INPUT');
  });

  it('republish_report delegates to PublishingRouteService', async () => {
    const t = historyTools.find((x) => x.id === 'republish_report')!;
    const r = await t.handler({ id: '1' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.status).toBe('success');
    expect(mockRepublish).toHaveBeenCalledWith('1');
  });

  it('republish_report returns NOT_FOUND for missing record', async () => {
    mockRepublish.mockRejectedValue(new AppError(404, 'History record not found'));
    const t = historyTools.find((x) => x.id === 'republish_report')!;
    const r = await t.handler({ id: '999' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('delete_commit_history succeeds', async () => {
    const t = historyTools.find((x) => x.id === 'delete_commit_history')!;
    const r = await t.handler({ id: '1' }, ctx());
    expect(r.ok).toBe(true);
    expect(mockDeleteCommitHistory).toHaveBeenCalledWith('1');
  });

  it('read tools have no execution policy', () => {
    for (const id of ['get_commit_history', 'get_publication_items']) {
      expect((historyTools.find((x) => x.id === id)! as { execution?: unknown }).execution).toBeUndefined();
    }
  });

  it('write tools declare execution policy', () => {
    expect(
      (historyTools.find((x) => x.id === 'republish_report')! as { execution: { riskLevel: string } }).execution
        .riskLevel,
    ).toBe('medium');
    expect(
      (historyTools.find((x) => x.id === 'delete_commit_history')! as { execution: { riskLevel: string } }).execution
        .riskLevel,
    ).toBe('high');
  });
});
