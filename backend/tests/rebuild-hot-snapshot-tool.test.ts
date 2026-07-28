import { beforeEach, describe, expect, it, vi } from 'vitest';

const runMergeAndSnapshot = vi.fn();

vi.mock('../src/services/feed/HotStoryMergeService.js', () => ({
  HotStoryMergeService: vi.fn(function HotStoryMergeService(this: { runMergeAndSnapshot: typeof runMergeAndSnapshot }) {
    this.runMergeAndSnapshot = runMergeAndSnapshot;
  })
}));

import { hotSnapshotTools } from '../src/plugins/builtin/tools/admin/hotSnapshotTools.js';

describe('rebuild_hot_snapshot tool', () => {
  const tool = hotSnapshotTools.find((t) => t.id === 'rebuild_hot_snapshot')!;
  const ctx = { store: {}, services: { localStore: {} } } as any;

  beforeEach(() => {
    runMergeAndSnapshot.mockReset();
  });

  it('returns ok counts from HotStoryMergeService', async () => {
    runMergeAndSnapshot.mockResolvedValue({
      eventCount: 3,
      generatedAt: '2026-07-23T10:00:00.000Z',
      itemCount: 40,
      clusterCount: 12,
      mergeModeRequested: 'hybrid',
      mergeModeApplied: 'hybrid'
    });
    await expect(tool.handler({}, ctx)).resolves.toEqual({
      ok: true,
      eventCount: 3,
      generatedAt: '2026-07-23T10:00:00.000Z',
      itemCount: 40,
      clusterCount: 12,
      mergeModeRequested: 'hybrid',
      mergeModeApplied: 'hybrid'
    });
  });

  it('passes mergeMode override to HotStoryMergeService', async () => {
    runMergeAndSnapshot.mockResolvedValue({
      eventCount: 1,
      generatedAt: '2026-07-23T10:00:00.000Z',
      itemCount: 10,
      clusterCount: 8,
      mergeModeRequested: 'rules',
      mergeModeApplied: 'rules'
    });
    await tool.handler({ mergeMode: 'rules' }, ctx);
    expect(runMergeAndSnapshot).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ mergeMode: 'rules' })
    );
  });

  it('returns ok:false and does not throw when merge fails', async () => {
    runMergeAndSnapshot.mockImplementation(async () => {
      throw new Error('db down');
    });
    const result = await tool.handler({}, ctx);
    expect(result).toMatchObject({
      ok: false,
      errorCode: 'REBUILD_HOT_SNAPSHOT_FAILED',
      message: 'db down'
    });
  });
});
