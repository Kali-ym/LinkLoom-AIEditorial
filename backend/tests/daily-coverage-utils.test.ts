import { describe, expect, it } from 'vitest';
import {
  buildCoverageRowsFromPlan,
  buildCoverageRowsFromMarkdown,
  matchPriorCoverageFromIndex,
  applyCrossDayHints,
  buildPriorCoveragePayload
} from '../src/utils/dailyCoverageUtils.js';
import { normalizeUrlForDedup } from '../src/utils/editorialUtils.js';

const plan = {
  topics: [
    {
      topic_id: 't1',
      action: 'keep' as const,
      headline: 'OpenAI 发布',
      importance_rank: 1,
      suggested_section: '产品与功能更新',
      source_items: [{ index: 1, title: 'A', url: 'https://openai.com/blog/x?utm=1' }]
    }
  ],
  dropped: []
};

describe('dailyCoverageUtils', () => {
  describe('buildCoverageRowsFromPlan', () => {
    it('builds rows with normalized URLs', () => {
      const rows = buildCoverageRowsFromPlan('2026-05-18', plan, Date.now());
      expect(rows).toHaveLength(1);
      expect(rows[0].url_norm).toBe(normalizeUrlForDedup('https://www.openai.com/blog/x'));
    });
  });

  describe('buildCoverageRowsFromMarkdown', () => {
    it('deduplicates URLs from markdown', () => {
      const mdRows = buildCoverageRowsFromMarkdown(
        '2026-05-17',
        '见 [链接](https://example.com/a) 与 https://example.com/a ',
        Date.now()
      );
      expect(mdRows).toHaveLength(1);
    });
  });

  describe('matchPriorCoverageFromIndex', () => {
    it('detects url_exact matches and suggests drop', () => {
      const rows = buildCoverageRowsFromPlan('2026-05-18', plan, Date.now());
      const indexRows = [
        ...rows.map((r) => ({ ...r, date: '2026-05-17' })),
        {
          date: '2026-05-17',
          topic_id: 't0',
          url_norm: normalizeUrlForDedup('https://other.com/y'),
          headline: '旧闻',
          section: '',
          importance_rank: 2,
          ingested_at: Date.now()
        }
      ];

      const items = [{ index: 2, title: '重复', url: 'https://openai.com/blog/x' }];
      const matches = matchPriorCoverageFromIndex(items, indexRows, {
        titleThreshold: 0.88,
        asOfDate: '2026-05-18'
      });
      expect(matches.some((m) => m.kind === 'url_exact' && m.suggestion === 'drop')).toBe(true);
    });
  });

  describe('applyCrossDayHints', () => {
    it('hard drops items matched by prior coverage', () => {
      const rows = buildCoverageRowsFromPlan('2026-05-18', plan, Date.now());
      const indexRows = [
        ...rows.map((r) => ({ ...r, date: '2026-05-17' })),
        {
          date: '2026-05-17',
          topic_id: 't0',
          url_norm: normalizeUrlForDedup('https://other.com/y'),
          headline: '旧闻',
          section: '',
          importance_rank: 2,
          ingested_at: Date.now()
        }
      ];

      const items = [{ index: 2, title: '重复', url: 'https://openai.com/blog/x' }];
      const matches = matchPriorCoverageFromIndex(items, indexRows, {
        titleThreshold: 0.88,
        asOfDate: '2026-05-18'
      });
      const prior = buildPriorCoveragePayload('2026-05-18', 7, indexRows, matches);
      const hinted = applyCrossDayHints(
        {
          input_count: 1,
          output_topic_count: 1,
          editorial_log: {
            received: 1,
            dedup_removed: 0,
            tier1_dropped: 0,
            tier3_kept: 0,
            tier5_kept: 0,
            clusters_formed: 0,
            topics_kept: 1
          },
          topics: [
            {
              topic_id: 't2',
              action: 'keep' as const,
              headline: '应被跨日剔除',
              ai_relevance_tier: 5,
              importance_rank: 1,
              importance_reason: '',
              suggested_section: '产品与功能更新',
              source_items: [{ index: 2, title: '重复', url: 'https://openai.com/blog/x' }]
            }
          ],
          dropped: []
        },
        prior,
        true
      );
      expect(hinted.topics).toHaveLength(0);
      expect(hinted.dropped).toHaveLength(1);
    });
  });

  describe('normalizeUrlForDedup (cross-module)', () => {
    it('normalizes URLs consistently across editorial and coverage utils', () => {
      expect(normalizeUrlForDedup('https://openai.com/blog/x?utm=1')).toBe(
        normalizeUrlForDedup('https://www.openai.com/blog/x')
      );
    });
  });
});
