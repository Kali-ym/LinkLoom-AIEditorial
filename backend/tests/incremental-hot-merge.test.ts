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

  it('llm mode: hard-attach ingests fingerprint aliases; kept-new bootstraps fingerprint', async () => {
    const { LLMMergeJudge } = await import('../src/services/feed/llmMergeJudge.js');
    const { bootstrapFingerprint, extractMiniProfile } = await import(
      '../src/services/feed/ClusterFingerprint.js'
    );
    const { vi } = await import('vitest');

    const seedItem = item({
      id: 'old',
      title: 'Kimi K3 launch',
      published_date: '2026-07-30T10:00:00.000Z',
      metadata: {
        event_id: 'evt_kimi',
        event_signature: 'moonshot-kimi-k3-release',
        entities: ['Moonshot AI', 'Kimi K3'],
        key_facts: ['开源'],
        ai_summary_short: '月之暗面发布 Kimi K3',
        ai_score: 85
      }
    });

    const fp = bootstrapFingerprint('evt_kimi', extractMiniProfile(seedItem));
    const fingerprints = [fp];
    const store = {
      loadAll: async () => fingerprints,
      save: async (f: (typeof fp)) => {
        const i = fingerprints.findIndex((x) => x.eventId === f.eventId);
        if (i >= 0) fingerprints[i] = f;
        else fingerprints.push(f);
      },
      delete: async () => undefined
    };
    const cache = {
      get: async () => null,
      set: async () => undefined
    };
    const provider = {
      name: 'mock',
      generateContent: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          judgments: [{ pair_index: 0, same_event: false, confidence: 0.2, reason: 'different' }]
        })
      })
    };

    const judge = new LLMMergeJudge({
      provider: provider as any,
      store,
      cache,
      maxJudgmentsPerRun: 50,
      cacheTtlMinutes: 360,
      sealAfterMs: 6 * 3600 * 1000,
      windowMs: 36 * 3600 * 1000
    });
    await judge.loadFingerprints();

    const { clusters } = await mergeHotStoriesIncremental(
      [
        seedItem,
        item({
          id: 'hard',
          title: 'Same signature follow-up',
          published_date: '2026-07-30T12:00:00.000Z',
          metadata: {
            event_signature: 'Moonshot/Kimi K3 release',
            entities: ['月之暗面', 'Kimi K3'],
            key_facts: ['开源'],
            ai_summary_short: 'Kimi K3 同事件报道',
            ai_score: 80
          }
        }),
        item({
          id: 'other',
          title: 'Unrelated',
          published_date: '2026-07-30T13:00:00.000Z',
          metadata: {
            event_signature: 'anthropic-claude-opus-release',
            entities: ['Anthropic', 'Claude Opus'],
            key_facts: ['新模型'],
            ai_summary_short: 'Anthropic 发布 Claude Opus',
            ai_score: 88
          }
        })
      ],
      { mergeMode: 'llm', llmJudge: judge }
    );

    const kimi = clusters.find((c) => c.eventId === 'evt_kimi');
    expect(kimi?.members.map((m) => m.id).sort()).toEqual(['hard', 'old']);

    const kimiFp = judge.getFingerprints().find((f) => f.eventId === 'evt_kimi')!;
    expect(kimiFp.aliases.some((a) => a.surface === '月之暗面')).toBe(true);

    const otherCluster = clusters.find((c) => c.members.some((m) => m.id === 'other'));
    expect(otherCluster).toBeTruthy();
    expect(otherCluster!.eventId).not.toBe('evt_kimi');
    const otherFp = judge.getFingerprints().find((f) => f.eventId === otherCluster!.eventId);
    expect(otherFp).toBeTruthy();
    expect(otherFp!.seedFingerprint.length).toBeGreaterThan(0);
  });

  it('llm mode bootstrap: merges paraphrase clusters via judge instead of rules', async () => {
    const { vi } = await import('vitest');
    const { LLMMergeJudge } = await import('../src/services/feed/llmMergeJudge.js');

    const store = {
      loadAll: async () => [],
      save: async () => undefined,
      delete: async () => undefined
    };
    const cache = {
      get: async () => null,
      set: async () => undefined
    };
    const provider = {
      name: 'mock',
      generateContent: vi.fn().mockImplementation(async (_user: string) => {
        return {
          content: JSON.stringify({
            judgments: [
              {
                pair_index: 0,
                same_event: true,
                confidence: 0.92,
                reason: 'same Kimi K3 open-weight release'
              }
            ]
          })
        };
      })
    };

    const judge = new LLMMergeJudge({
      provider: provider as any,
      store,
      cache,
      maxJudgmentsPerRun: 50,
      cacheTtlMinutes: 360,
      sealAfterMs: 6 * 3600 * 1000,
      windowMs: 36 * 3600 * 1000
    });
    await judge.loadFingerprints();

    const { clusters, bootstrapped, mergeModeApplied } = await mergeHotStoriesIncremental(
      [
        item({
          id: 'decoder',
          title: 'Moonshot AI releases Kimi K3 open weights',
          published_date: '2026-07-27T19:35:08.000Z',
          metadata: {
            event_signature: 'Moonshot AI-Kimi K3-开源权重与基础设施',
            entities: ['Moonshot AI', 'Kimi K3'],
            ai_summary_short: 'Moonshot AI 开源 Kimi K3 权重与部分基础设施',
            ai_score: 85
          }
        }),
        item({
          id: 'hf',
          title: 'moonshotai/Kimi-K3',
          published_date: '2026-07-27T23:39:04.000Z',
          metadata: {
            event_signature: 'Moonshot AI-Kimi K3-发布权重',
            entities: ['Moonshot AI', 'Kimi K3', 'Hugging Face'],
            ai_summary_short: 'Moonshot发布Kimi K3权重',
            ai_score: 90
          }
        })
      ],
      { mergeMode: 'llm', llmJudge: judge }
    );

    expect(bootstrapped).toBe(true);
    expect(mergeModeApplied).toBe('llm');
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['decoder', 'hf']);
    expect(provider.generateContent).toHaveBeenCalled();
  });
});
