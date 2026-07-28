import { describe, expect, it } from 'vitest';
import {
  buildDeterministicDigest,
  buildFallbackRoutedItem,
  clampHeadlinesMarkdown,
  reconcileRoutedBatchItems
} from '../src/utils/dailyPipelineBatchHelpers.js';
import { normalizeSourceUrlLines } from '../src/utils/normalizeDailyMarkdown.js';

describe('DailyPipelineBatch helpers', () => {
  describe('buildDeterministicDigest', () => {
    it('builds title-only headlines and grouped body sections', () => {
      const digest = buildDeterministicDigest(
        {
          count: 3,
          items: [
            {
              index: 1,
              title: 'A',
              importance_rank: 1,
              headline_candidate: true,
              section: '模型与权重',
              body_md: '正文A。'
            },
            {
              index: 2,
              title: 'B',
              importance_rank: 2,
              headline_candidate: true,
              section: '研究与评测',
              body_md: '正文B。'
            },
            {
              index: 3,
              title: 'C',
              importance_rank: 3,
              section: 'Agent 与工具',
              body_md: '正文C。'
            }
          ]
        },
        5
      );

      expect(digest.headlines_markdown).toContain('## **今日要闻**');
      expect(digest.headlines_markdown).not.toContain('```');
      expect(digest.headlines_markdown).not.toContain('正文A');
      expect(digest.body_markdown).toContain('### 模型与权重');
      expect(digest.body_markdown).not.toContain('今日摘要');
    });
  });

  describe('clampHeadlinesMarkdown', () => {
    it('limits headline list and removes teaser text', () => {
      const oversizedHeadlines = clampHeadlinesMarkdown(
        `## **今日要闻**\n\n${[1, 2, 3, 4, 5, 6, 7, 8]
          .map((i) => `${i}. **H${i}**\n导读${i}`)
          .join('\n\n')}`,
        5
      );

      expect(oversizedHeadlines).not.toContain('6. **H6**');
      expect(oversizedHeadlines).toContain('5. **H5**');
      expect(oversizedHeadlines).not.toContain('导读5');
    });
  });

  describe('normalizeSourceUrlLines', () => {
    it('splits plain source URL line before next numbered item', () => {
      const normalizedSourceContinuation = normalizeSourceUrlLines(
        '来源：https://www.qbitai.com/2026/05/420084.html 3. **Cursor发布Composer 2.5新模型**\n正文'
      );

      expect(normalizedSourceContinuation).toContain(
        '来源：[https://www.qbitai.com/2026/05/420084.html](https://www.qbitai.com/2026/05/420084.html)\n\n3. **Cursor发布Composer 2.5新模型**'
      );
    });

    it('splits linked source URL line before next numbered item', () => {
      const normalizedLinkedSourceContinuation = normalizeSourceUrlLines(
        '来源：[https://a.com/1](https://a.com/1) 4. **下一条新闻**'
      );

      expect(normalizedLinkedSourceContinuation).toBe(
        '来源：[https://a.com/1](https://a.com/1)\n\n4. **下一条新闻**'
      );
    });
  });

  describe('reconcileRoutedBatchItems', () => {
    it('fills missing routed rows and normalizes legacy section names', () => {
      const batchIn = [
        { index: 1, title: 'A', url: 'https://a.com/1', description: 'da' },
        { index: 2, title: 'B', url: 'https://b.com/2', description: 'db' },
        { index: 3, title: 'C', url: 'https://c.com/3', description: 'dc' }
      ];
      const reconciled = reconcileRoutedBatchItems(batchIn, [
        { index: 1, title: 'A', url: 'https://a.com/1', suggested_section: '前沿研究' }
      ]);

      expect(reconciled).toHaveLength(3);
      expect(reconciled[0].suggested_section).toBe('研究与评测');
      expect(buildFallbackRoutedItem(batchIn[1], 2).index).toBe(2);
    });
  });
});
