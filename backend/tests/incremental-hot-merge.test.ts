import { describe, expect, it } from 'vitest';
import type { HotClusterItem } from '../src/services/feed/hotEvents.js';
import { mergeHotStoriesIncremental } from '../src/services/feed/incrementalHotMerge.js';

function item(partial: Partial<HotClusterItem> & { id: string; title: string }): HotClusterItem {
  return {
    source: 'Source',
    published_date: '2026-07-21T12:00:00.000Z',
    ...partial
  };
}

describe('mergeHotStoriesIncremental', () => {
  it('bootstraps with full merge when no sticky event_ids exist', async () => {
    const { clusters, bootstrapped } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'a',
          title: 'A',
          metadata: { event_signature: 'openai-gpt5-发布', entities: ['OpenAI', 'GPT-5'] }
        }),
        item({
          id: 'b',
          title: 'B',
          metadata: { event_signature: 'OpenAI/GPT5 发布', entities: ['OpenAI', 'GPT-5'] }
        })
      ],
      { mergeMode: 'rules' }
    );
    expect(bootstrapped).toBe(true);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps sticky members together and does not merge two sticky clusters', async () => {
    const { clusters, bootstrapped } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'a1',
          title: 'OpenAI launches GPT-5 model',
          source: 'A',
          metadata: {
            event_id: 'evt_sticky_a',
            event_signature: 'openai-gpt5-launch',
            entities: ['OpenAI', 'GPT-5'],
            ai_summary_short: 'OpenAI 发布 GPT-5 模型'
          }
        }),
        item({
          id: 'b1',
          title: 'GPT-5 model launched by OpenAI',
          source: 'B',
          metadata: {
            event_id: 'evt_sticky_b',
            event_signature: 'openai-new-model',
            entities: ['OpenAI', 'GPT5', 'Sam Altman'],
            ai_summary_short: 'OpenAI 正式发布 GPT-5 模型'
          }
        })
      ],
      { mergeMode: 'rules' }
    );
    expect(bootstrapped).toBe(false);
    expect(clusters).toHaveLength(2);
    const byId = new Map(clusters.map((c) => [c.eventId, c]));
    expect(byId.get('evt_sticky_a')?.members.map((m) => m.id)).toEqual(['a1']);
    expect(byId.get('evt_sticky_b')?.members.map((m) => m.id)).toEqual(['b1']);
  });

  it('hard-attaches a new item that shares sticky signature', async () => {
    const { clusters } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'old',
          title: 'Old',
          source: 'A',
          metadata: {
            event_id: 'evt_nvidia',
            event_signature: 'nvidia-open-models',
            ai_summary_short: '英伟达支持开放模型'
          }
        }),
        item({
          id: 'newbie',
          title: 'New',
          source: 'TechCrunch',
          metadata: {
            event_signature: 'NVIDIA/open-models',
            ai_summary_short: '另一篇关于开放模型'
          }
        })
      ],
      { mergeMode: 'rules' }
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].eventId).toBe('evt_nvidia');
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['newbie', 'old']);
  });

  it('hard-attaches when new tip is within 36h of sticky tip even if span from oldest exceeds 36h', async () => {
    const { clusters } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'oldest',
          title: 'Old',
          source: 'A',
          published_date: '2026-07-18T12:00:00.000Z',
          metadata: {
            event_id: 'evt_nvidia',
            event_signature: 'nvidia-open-models',
            ai_summary_short: '英伟达支持开放模型'
          }
        }),
        item({
          id: 'tip',
          title: 'Tip',
          source: 'B',
          published_date: '2026-07-20T12:00:00.000Z',
          metadata: {
            event_id: 'evt_nvidia',
            event_signature: 'nvidia-open-models',
            ai_summary_short: '开放模型倡议后续'
          }
        }),
        item({
          id: 'newbie',
          title: 'New',
          source: 'TechCrunch',
          published_date: '2026-07-21T12:00:00.000Z',
          metadata: {
            event_signature: 'NVIDIA/open-models',
            ai_summary_short: '另一篇关于开放模型'
          }
        })
      ],
      { mergeMode: 'rules' }
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].eventId).toBe('evt_nvidia');
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['newbie', 'oldest', 'tip']);
  });

  it('does not hard-attach when newcomer tip is more than 36h after sticky tip', async () => {
    const { clusters } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'oldest',
          title: 'Old',
          source: 'A',
          published_date: '2026-07-18T12:00:00.000Z',
          metadata: {
            event_id: 'evt_nvidia',
            event_signature: 'nvidia-open-models',
            ai_summary_short: '英伟达支持开放模型'
          }
        }),
        item({
          id: 'tip',
          title: 'Tip',
          source: 'B',
          published_date: '2026-07-19T12:00:00.000Z',
          metadata: {
            event_id: 'evt_nvidia',
            event_signature: 'nvidia-open-models',
            ai_summary_short: '开放模型倡议后续'
          }
        }),
        item({
          id: 'newbie',
          title: 'New',
          source: 'TechCrunch',
          published_date: '2026-07-21T12:00:00.000Z',
          metadata: {
            event_signature: 'NVIDIA/open-models',
            ai_summary_short: '另一篇关于开放模型'
          }
        })
      ],
      { mergeMode: 'rules' }
    );
    expect(clusters).toHaveLength(2);
    const sticky = clusters.find((c) => c.eventId === 'evt_nvidia');
    const neu = clusters.find((c) => c.eventId !== 'evt_nvidia');
    expect(sticky?.members.map((m) => m.id).sort()).toEqual(['oldest', 'tip']);
    expect(neu?.members.map((m) => m.id)).toEqual(['newbie']);
  });

  it('soft-attaches a related newcomer into the sticky cluster', async () => {
    const { clusters } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'old',
          title: 'OpenAI launches GPT-5 model',
          source: 'Alpha',
          metadata: {
            event_id: 'evt_gpt5',
            event_signature: 'openai-gpt5-launch',
            entities: ['OpenAI', 'GPT-5'],
            ai_summary_short: 'OpenAI 发布 GPT-5 模型'
          }
        }),
        item({
          id: 'newbie',
          title: 'GPT-5 model launched by OpenAI',
          source: 'Beta',
          metadata: {
            event_signature: 'openai-new-model',
            entities: ['OpenAI', 'GPT5', 'Sam Altman'],
            ai_summary_short: 'OpenAI 正式发布 GPT-5 模型'
          }
        })
      ],
      { mergeMode: 'rules' }
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].eventId).toBe('evt_gpt5');
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['newbie', 'old']);
  });

  it('creates a new cluster when the newcomer does not match sticky', async () => {
    const { clusters } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'old',
          title: 'OpenAI launches GPT-5',
          source: 'A',
          metadata: {
            event_id: 'evt_gpt5',
            event_signature: 'openai-gpt5',
            entities: ['OpenAI', 'GPT-5'],
            ai_summary_short: 'OpenAI 发布 GPT-5 模型'
          }
        }),
        item({
          id: 'other',
          title: 'Unrelated weather update',
          source: 'B',
          published_date: '2026-07-22T12:00:00.000Z',
          metadata: {
            event_signature: 'local-weather',
            entities: ['Shanghai'],
            ai_summary_short: '上海今日多云转晴'
          }
        })
      ],
      { mergeMode: 'rules' }
    );
    expect(clusters).toHaveLength(2);
    const sticky = clusters.find((c) => c.eventId === 'evt_gpt5');
    const neu = clusters.find((c) => c.eventId !== 'evt_gpt5');
    expect(sticky?.members.map((m) => m.id)).toEqual(['old']);
    expect(neu?.members.map((m) => m.id)).toEqual(['other']);
  });

  it('does not pull sticky members out when re-running with the same pool', async () => {
    const pool = [
      item({
        id: 'a',
        title: 'OpenAI launches GPT-5 model',
        source: 'Alpha',
        metadata: {
          event_id: 'evt_gpt5',
          event_signature: 'openai-gpt5-launch',
          entities: ['OpenAI', 'GPT-5'],
          ai_summary_short: 'OpenAI 发布 GPT-5 模型'
        }
      }),
      item({
        id: 'b',
        title: 'Borderline related note',
        source: 'TechCrunch',
        metadata: {
          event_id: 'evt_gpt5',
          event_signature: 'industry-open-weights',
          entities: ['OpenAI', 'Mistral'],
          ai_summary_short: '行业呼吁开放权重模型政策'
        }
      }),
      item({
        id: 'c',
        title: 'Separate Claude story',
        source: 'C',
        metadata: {
          event_id: 'evt_claude',
          event_signature: 'claude-opus-5',
          entities: ['Anthropic', 'Claude'],
          ai_summary_short: 'Anthropic 发布 Claude Opus 5'
        }
      })
    ];

    const first = await mergeHotStoriesIncremental(pool, { mergeMode: 'rules' });
    const second = await mergeHotStoriesIncremental(pool, { mergeMode: 'rules' });

    const membersOf = (result: typeof first, eid: string) =>
      result.clusters
        .find((c) => c.eventId === eid)
        ?.members.map((m) => m.id)
        .sort();

    expect(membersOf(first, 'evt_gpt5')).toEqual(['a', 'b']);
    expect(membersOf(second, 'evt_gpt5')).toEqual(['a', 'b']);
    expect(membersOf(first, 'evt_claude')).toEqual(['c']);
    expect(membersOf(second, 'evt_claude')).toEqual(['c']);
  });

  it('attaches via embedding in semantic mode', async () => {
    const embed = async (texts: string[]) =>
      texts.map((t) => {
        if (t.includes('开放模型') || t.includes('open model')) return [1, 0, 0, 0];
        return [0, 1, 0, 0];
      });

    const { clusters } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'old',
          title: 'Nvidia open models',
          source: 'NVIDIA',
          metadata: {
            event_id: 'evt_nv',
            event_signature: 'nvidia-open',
            ai_summary_short: '英伟达支持开放模型倡议'
          }
        }),
        item({
          id: 'newbie',
          title: 'TechCrunch coverage',
          source: 'TechCrunch',
          metadata: {
            event_signature: 'tc-open-weights',
            ai_summary_short: '媒体报道开放模型政策呼吁'
          }
        })
      ],
      { mergeMode: 'semantic', embed, similarityMin: 0.9 }
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0].eventId).toBe('evt_nv');
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['newbie', 'old']);
  });
});
