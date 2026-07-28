import { describe, expect, it } from 'vitest';
import {
  deduplicatePipelineItems,
  reconcileEditorialPlanCoverage,
  titleSimilarity,
  normalizeUrlForDedup
} from '../src/utils/editorialUtils.js';
import { normalizeDailySection } from '../src/config/dailySections.js';

const urlA = 'https://openai.com/blog/hello?utm=1';
const urlB = 'https://www.openai.com/blog/hello';

const items = [
  { index: 1, title: 'OpenAI 发布 GPT-5', url: urlA, source: 'openai.com' },
  { index: 2, title: 'OpenAI 发布 GPT-5 新模型', url: urlB, source: 'aggregator' },
  { index: 3, title: '无关股市波动', url: 'https://example.com/stock', source: 'news' }
];

describe('editorialUtils', () => {
  describe('normalizeUrlForDedup', () => {
    it('normalizes www and query params', () => {
      expect(normalizeUrlForDedup(urlA)).toBe(normalizeUrlForDedup(urlB));
    });
  });

  describe('deduplicatePipelineItems', () => {
    it('removes duplicate items by normalized URL', () => {
      const deduped = deduplicatePipelineItems(items);
      expect(deduped.items.length).toBe(2);
      expect(deduped.removed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('titleSimilarity', () => {
    it('returns high score for similar titles', () => {
      expect(titleSimilarity('OpenAI 发布新模型', 'OpenAI 发布新模型！')).toBeGreaterThan(0.85);
    });
  });

  describe('normalizeDailySection', () => {
    it('maps legacy section names', () => {
      expect(normalizeDailySection('产品与功能更新')).toBe('产品与商业');
      expect(normalizeDailySection('Agent 与开发者工具')).toBe('Agent 与工具');
      expect(normalizeDailySection('模型发布/更新')).toBe('模型与权重');
      expect(normalizeDailySection('论文研究')).toBe('研究与评测');
    });

    it('passes through current section names', () => {
      expect(normalizeDailySection('产品与商业')).toBe('产品与商业');
    });
  });

  describe('reconcileEditorialPlanCoverage', () => {
    it('fails on missing plan coverage instead of auto recovering', () => {
      const sparsePlan = {
        input_count: 5,
        output_topic_count: 2,
        editorial_log: {
          received: 5,
          dedup_removed: 0,
          tier1_dropped: 0,
          tier3_kept: 0,
          tier5_kept: 2,
          clusters_formed: 0,
          topics_kept: 2
        },
        topics: [
          {
            topic_id: 't1',
            action: 'keep' as const,
            headline: 'A',
            ai_relevance_tier: 5,
            importance_rank: 1,
            importance_reason: '',
            suggested_section: '产品与商业',
            source_items: [{ index: 1, title: 'A', url: 'https://a.com' }]
          },
          {
            topic_id: 't2',
            action: 'keep' as const,
            headline: 'B',
            ai_relevance_tier: 5,
            importance_rank: 2,
            importance_reason: '',
            suggested_section: '产品与商业',
            source_items: [{ index: 2, title: 'B', url: 'https://b.com' }]
          }
        ],
        dropped: []
      };
      const fiveItems = [1, 2, 3, 4, 5].map((i) => ({
        index: i,
        title: `T${i}`,
        url: `https://x.com/${i}`,
        suggested_section: '产品与商业'
      }));
      expect(() => reconcileEditorialPlanCoverage(sparsePlan, fiveItems)).toThrow(
        /missing indices/
      );
    });

    it('backfills route and material data on reconcile', () => {
      const completePlan = {
        input_count: 2,
        output_topic_count: 1,
        editorial_log: {
          received: 2,
          dedup_removed: 0,
          tier1_dropped: 0,
          tier3_kept: 0,
          tier5_kept: 1,
          clusters_formed: 0,
          topics_kept: 1
        },
        topics: [
          {
            topic_id: 't1',
            action: 'merge' as const,
            headline: 'AB',
            ai_relevance_tier: 5,
            importance_rank: 1,
            importance_reason: '',
            suggested_section: '产品与商业',
            source_items: [
              { index: 1, title: 'A', url: 'https://a.com' },
              { index: 2, title: 'B', url: 'https://b.com' }
            ]
          }
        ],
        dropped: []
      };
      const enriched = reconcileEditorialPlanCoverage(
        completePlan,
        [
          {
            index: 1,
            title: 'A',
            url: 'https://a.com',
            source_summary: '摘要A',
            key_facts: ['A fact']
          },
          {
            index: 2,
            title: 'B',
            url: 'https://b.com',
            source_summary: '摘要B',
            key_facts: ['B fact']
          }
        ],
        {
          routeItems: [
            { index: 1, suggested_section: '研究与评测' },
            { index: 2, suggested_section: '研究与评测' }
          ],
          materialItems: [
            {
              index: 1,
              source_summary: '摘要A',
              key_facts: ['A fact'],
              event_signature: 'event-a'
            },
            { index: 2, source_summary: '摘要B', key_facts: ['B fact'], event_signature: 'event-a' }
          ]
        }
      );
      expect(enriched.topics[0].suggested_section).toBe('研究与评测');
      expect(enriched.topics[0].source_items[0].source_summary).toBe('摘要A');
      expect(enriched.editorial_log.items_auto_recovered).toBe(0);
    });
  });
});
