import { describe, expect, it } from 'vitest';
import { DigestContextService } from '../src/services/editorial/DigestContextService.js';

function createService(values: Record<string, unknown>) {
  return new DigestContextService({
    async get(key: string) {
      return values[key];
    }
  } as never);
}

describe('DigestContextService', () => {
  it('returns stale empty context when digest KV is missing', async () => {
    const service = createService({});

    const context = await service.getDigestContext('2026-06-06T10:00:00.000Z');

    expect(context.date).toBe('2026-06-06');
    expect(context.stale).toBe(true);
    expect(context.missingKeys).toEqual([
      'hot_topics_digest:2026-06-06',
      'source_monitor_snapshot:2026-06-06',
      'topic_track_digest:2026-06-06'
    ]);
    expect(context.suggestedDailyOneXTopics).toEqual([]);
    expect(context.hotHeadlines).toEqual([]);
    expect(context.monitorAlerts).toEqual([]);
    expect(context.trackedThemes).toEqual([]);
  });

  it('normalizes platform digest KV into daily topic hints', async () => {
    const service = createService({
      'hot_topics_digest:2026-06-06': {
        items: [
          {
            title: '低分热点',
            source: '社区源',
            url: 'https://example.com/low',
            metadata: { ai_score: 80 }
          },
          {
            metadata: {
              translated_title: '高分开源模型发布',
              source: '官方源',
              ai_score: '95',
              url: 'https://example.com/high'
            }
          }
        ]
      },
      'source_monitor_snapshot:2026-06-06': {
        items: [
          { title: '官方更新 A', source: '官方源' },
          { title: '官方更新 B', source: '官方源' },
          { title: '社区动态', adapterName: '社区源' }
        ]
      },
      'topic_track_digest:2026-06-06': {
        items: [
          { title: 'Agent 工具链更新', metadata: { ai_tags: ['AI Agent', '开源模型'] } },
          { title: '推理模型进展', ai_tags: 'AI Agent, 推理模型' }
        ]
      }
    });

    const context = await service.getDigestContext('2026-06-06');

    expect(context.stale).toBe(false);
    expect(context.hotHeadlines[0]).toMatchObject({
      title: '高分开源模型发布',
      source: '官方源',
      score: 95,
      url: 'https://example.com/high'
    });
    expect(context.monitorAlerts[0]).toMatchObject({
      source: '官方源',
      count: 2,
      topTitle: '官方更新 A'
    });
    expect(context.trackedThemes[0]).toMatchObject({
      tag: 'AI Agent',
      itemCount: 2,
      sampleTitles: ['Agent 工具链更新', '推理模型进展']
    });
    expect(context.suggestedDailyOneXTopics).toEqual([
      'AI Agent',
      '开源模型',
      '推理模型'
    ]);
  });
});