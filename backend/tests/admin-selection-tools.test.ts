import { describe, expect, it, vi, beforeEach } from 'vitest';
import { selectionTools } from '../src/plugins/builtin/tools/admin/selectionTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const { mockGetAdminStats, mockQueryPublicationItems } = vi.hoisted(() => ({
  mockGetAdminStats: vi.fn(),
  mockQueryPublicationItems: vi.fn(),
}));

vi.mock('../src/services/api/FeedRouteService.js', () => ({
  FeedRouteService: class MockFeedRouteService {
    getAdminStats = mockGetAdminStats;
  },
}));

vi.mock('../src/services/api/PublishingRouteService.js', () => ({
  PublishingRouteService: class MockPublishingRouteService {
    queryPublicationItems = mockQueryPublicationItems;
  },
}));

function ctx(overrides: Record<string, unknown> = {}): ToolExecutionContext {
  return {
    store: {
      repositories: {
        sourceData: {
          list: vi.fn().mockResolvedValue({
            total: 3,
            items: [
              {
                id: 'n1',
                title: 'AI 新闻',
                source: 'hn',
                published_date: '2026-06-29',
                metadata: { ai_score: 85, ai_topic: 'model', ai_picked: true },
              },
            ],
          }),
        },
      },
    },
    services: {},
    ...overrides,
  } as unknown as ToolExecutionContext;
}

describe('admin selection tools', () => {
  beforeEach(() => {
    mockGetAdminStats.mockReset();
    mockQueryPublicationItems.mockReset();
    mockGetAdminStats.mockResolvedValue({
      raw: 12,
      processed24h: 8,
      failed24h: 0,
      passRate24h: 100,
      lastDigestAt: '2026-06-29T12:00:00Z',
    });
    mockQueryPublicationItems.mockResolvedValue({
      asOfDate: '2026-06-29',
      namespace: 'default',
      items: [{ title: '续报条目' }],
    });
  });

  it('list_processed_news maps scored items with filters', async () => {
    const t = selectionTools.find((x) => x.id === 'list_processed_news')!;
    const c = ctx();
    const r = await t.handler(
      { date: '2026-06-29', topic: 'model', sourceType: 'blog', picked: true, limit: 10 },
      c,
    );
    expect(r.ok).toBe(true);
    expect(r.items[0]).toMatchObject({
      id: 'n1',
      title: 'AI 新闻',
      score: 85,
      topic: 'model',
      source: 'hn',
    });
    expect(c.store.repositories.sourceData.list).toHaveBeenCalledWith(
      expect.objectContaining({
        hasAiScored: true,
        aiTopic: 'model',
        aiSourceTypes: ['blog'],
        aiPicked: true,
        ingestionDate: '2026-06-29',
        limit: 10,
      }),
    );
  });

  it('get_selection_stats returns admin stats', async () => {
    const t = selectionTools.find((x) => x.id === 'get_selection_stats')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.stats).toMatchObject({ raw: 12, processed24h: 8, passRate24h: 100 });
    expect(mockGetAdminStats).toHaveBeenCalled();
  });

  it('query_continuation_report delegates to PublishingRouteService', async () => {
    const t = selectionTools.find((x) => x.id === 'query_continuation_report')!;
    const r = await t.handler(
      { asOfDate: '2026-06-28', lookbackDays: 7, namespace: 'default' },
      ctx(),
    );
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(mockQueryPublicationItems).toHaveBeenCalledWith({
      asOfDate: '2026-06-28',
      lookbackDays: 7,
      namespace: 'default',
    });
  });

  it('selection tools have no execution policy', () => {
    for (const t of selectionTools) {
      expect((t as { execution?: unknown }).execution).toBeUndefined();
    }
  });
});
