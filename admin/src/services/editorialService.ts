import { request } from './api';

export type CoverageBackfillResult = {
  processed: number;
  skipped: number;
  dates: string[];
  errors: string[];
  dryRun?: boolean;
  itemCount?: number;
  deletedDailyMemoryEntries?: number;
  deletedDailyMemoryCategories?: number;
};

export const backfillCoverage = (limit = 60): Promise<CoverageBackfillResult> =>
  request('/api/history/publication-items/backfill', {
    method: 'POST',
    body: JSON.stringify({ limit, dryRun: false })
  });
