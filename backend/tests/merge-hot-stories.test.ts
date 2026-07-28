import { describe, expect, it } from 'vitest';
import {
  mergeHotStories,
  entityJaccard,
  titleTokenOverlap,
  softMergeScore
} from '../src/services/feed/mergeHotStories.js';
import { normalizeEntityToken } from '../src/services/feed/normalizeEntity.js';
import type { HotClusterItem } from '../src/services/feed/hotEvents.js';

function item(partial: Partial<HotClusterItem> & { id: string; title: string }): HotClusterItem {
  return {
    source: 'Source',
    published_date: '2026-07-21T12:00:00.000Z',
    ...partial
  };
}

describe('mergeHotStories', () => {
  it('hard-merges items with the same normalized signature', () => {
    const clusters = mergeHotStories([
      item({
        id: 'a',
        title: 'A',
        source: 'OpenAI',
        metadata: { event_signature: 'OpenAI/GPT5 发布' }
      }),
      item({
        id: 'b',
        title: 'B',
        source: 'TC',
        metadata: { event_signature: 'openai-gpt5-发布' }
      })
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['a', 'b']);
    expect(clusters[0].eventId.startsWith('evt_')).toBe(true);
  });

  it('soft-merges when entities and summaries align within 36h', () => {
    const clusters = mergeHotStories([
      item({
        id: 'x1',
        title: 'OpenAI launches GPT-5 model',
        source: 'Alpha',
        metadata: {
          event_signature: 'openai-gpt5-launch',
          entities: ['OpenAI', 'GPT-5'],
          ai_summary_short: 'OpenAI 发布 GPT-5 模型'
        }
      }),
      item({
        id: 'x2',
        title: 'GPT-5 model launched by OpenAI',
        source: 'Beta',
        metadata: {
          event_signature: 'openai-new-model',
          entities: ['OpenAI', 'GPT5', 'Sam Altman'],
          ai_summary_short: 'OpenAI 正式发布 GPT-5 模型'
        }
      })
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual(['x1', 'x2']);
  });

  it('soft-merges on shared numbers + high summary overlap without entities', () => {
    const clusters = mergeHotStories([
      item({
        id: 'n1',
        title: 'Qwen audio release notes',
        source: 'A',
        metadata: {
          event_signature: 'qwen-audio-a',
          numbers: ['3.0', 'Qwen-Audio-3.0'],
          ai_summary_short: 'Qwen 发布 Qwen-Audio-3.0 TTS 支持实时交互'
        }
      }),
      item({
        id: 'n2',
        title: 'Alibaba ships new TTS',
        source: 'B',
        metadata: {
          event_signature: 'qwen-audio-b',
          numbers: ['3.0'],
          ai_summary_short: 'Qwen 发布 Qwen-Audio-3.0 支持实时交互与高质量生成'
        }
      })
    ]);
    expect(clusters).toHaveLength(1);
  });

  it('soft-merges ChatGPT Health variants despite divergent entity tails', () => {
    const clusters = mergeHotStories([
      item({
        id: 'v1',
        title: 'OpenAI rolls out ChatGPT Health',
        source: 'Verge',
        metadata: {
          event_signature: 'OpenAI-ChatGPT Health-launch',
          entities: ['OpenAI', 'ChatGPT Health', 'Ashley Alexander'],
          ai_summary_short: 'OpenAI 向全美用户推出 ChatGPT Health 医疗功能',
          key_facts: ['向全美用户推出', 'ChatGPT Health']
        }
      }),
      item({
        id: 'v2',
        title: 'ChatGPT Health available to all US users',
        source: 'TC',
        metadata: {
          event_signature: 'OpenAI-ChatGPT Health-开放全美用户',
          entities: ['OpenAI', 'ChatGPT Health', 'Apple Health', 'MyFitnessPal'],
          ai_summary_short: 'OpenAI 向全美用户开放 ChatGPT Health',
          key_facts: ['向全美用户开放', 'ChatGPT Health']
        }
      })
    ]);
    expect(clusters).toHaveLength(1);
  });

  it('does not soft-merge when anchors are missing', () => {
    const clusters = mergeHotStories([
      item({
        id: 'a',
        title: 'OpenAI launches GPT-5 model today',
        source: 'A',
        metadata: {
          event_signature: 'sig-a',
          ai_summary_short: 'OpenAI 发布 GPT-5'
        }
      }),
      item({
        id: 'b',
        title: 'OpenAI launches GPT-5 model update',
        source: 'B',
        metadata: {
          event_signature: 'sig-b',
          ai_summary_short: 'OpenAI 发布 GPT-5 更新'
        }
      })
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('does not soft-merge OpenAI-only junk RT into a real Voice story', () => {
    const clusters = mergeHotStories([
      item({
        id: 'voice',
        title: 'ChatGPT Voice is now in the desktop app',
        source: 'OpenAI',
        metadata: {
          event_signature: 'OpenAI-ChatGPT Voice-桌面发布',
          entities: ['OpenAI', 'ChatGPT', 'GPT-Live', 'Codex'],
          ai_summary_short: 'OpenAI 在桌面端推出 ChatGPT Voice 语音控制与多代理调度。'
        }
      }),
      item({
        id: 'junk',
        title: 'RT Nick: http://x.com/i/article/2080116032862384128',
        source: 'OpenAI Developers',
        metadata: {
          event_signature: 'OpenAI-转推-Nick',
          entities: ['OpenAI'],
          ai_summary_short: 'OpenAI Devs转推Nick文章'
        }
      })
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('does not soft-merge empty broadcast into ChatGPT Health', () => {
    const clusters = mergeHotStories([
      item({
        id: 'health',
        title: 'OpenAI makes ChatGPT Health available to all US users',
        source: 'TC',
        metadata: {
          event_signature: 'OpenAI-ChatGPT Health-开放全美用户',
          entities: ['OpenAI', 'ChatGPT Health'],
          ai_summary_short: 'OpenAI 向全美用户开放 ChatGPT Health'
        }
      }),
      item({
        id: 'bcast',
        title: 'https://x.com/i/broadcasts/1DxleegbXYjKL',
        source: 'OpenAI Developers',
        metadata: {
          event_signature: 'OpenAI-广播-直播',
          entities: ['OpenAI'],
          ai_summary_short: 'OpenAI Developers 发起广播直播'
        }
      })
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('does not soft-merge HF physical-guard joke with unrelated HF hack story', () => {
    const clusters = mergeHotStories([
      item({
        id: 'joke',
        title: 'RT LeRobot: physical guards on robots',
        source: 'Hugging Face',
        metadata: {
          event_signature: 'hf-guard-joke',
          entities: ['Hugging Face', 'OpenAI', 'LeRobot'],
          ai_summary_short: 'Hugging Face为机器人加装物理护栏'
        }
      }),
      item({
        id: 'hack',
        title: 'How OpenAI human mistake led to hack on Hugging Face',
        source: 'TC',
        metadata: {
          event_signature: 'openai-hf-hack',
          entities: ['OpenAI', 'Hugging Face'],
          ai_summary_short: 'OpenAI 配置错误导致 Hugging Face 遭 AI 驱动黑客攻击'
        }
      })
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('does not soft-merge brand-only entity with unrelated summaries', () => {
    const clusters = mergeHotStories([
      item({
        id: 'fun',
        title: 'RT laptop plug joke',
        source: 'X',
        metadata: {
          event_signature: 'openai-fun',
          entities: ['OpenAI'],
          ai_summary_short: '官方转发用户用 codex 查笔记本是否插电的趣闻'
        }
      }),
      item({
        id: 'bill',
        title: 'AI kill switch bill',
        source: 'Wire',
        metadata: {
          event_signature: 'ai-kill-switch',
          entities: ['OpenAI', 'DHS'],
          ai_summary_short: '美议员将提 AI 关闭开关法案要求按 DHS 命令关停'
        }
      })
    ]);
    expect(clusters).toHaveLength(2);
    const score = softMergeScore(
      { members: [clusters[0].members[0]] },
      { members: [clusters[1].members[0]] }
    );
    expect(score.ok).toBe(false);
  });

  it('does not soft-merge when publish delta exceeds 36h', () => {
    const clusters = mergeHotStories([
      item({
        id: 'old',
        title: 'OpenAI launches GPT-5 model',
        published_date: '2026-07-19T12:00:00.000Z',
        metadata: {
          event_signature: 'sig-old',
          entities: ['OpenAI', 'GPT-5'],
          ai_summary_short: 'OpenAI 发布 GPT-5 模型'
        }
      }),
      item({
        id: 'new',
        title: 'GPT-5 model launched by OpenAI',
        published_date: '2026-07-21T12:00:00.000Z',
        metadata: {
          event_signature: 'sig-new',
          entities: ['OpenAI', 'GPT-5'],
          ai_summary_short: 'OpenAI 正式发布 GPT-5 模型'
        }
      })
    ]);
    expect(clusters).toHaveLength(2);
  });

  it('reuses previous event_id when members overlap', () => {
    const prev = new Map([
      ['a', 'evt_stable123'],
      ['b', 'evt_stable123']
    ]);
    const clusters = mergeHotStories(
      [
        item({
          id: 'a',
          title: 'A',
          metadata: { event_signature: 'same-event' }
        }),
        item({
          id: 'b',
          title: 'B',
          metadata: { event_signature: 'same-event' }
        })
      ],
      { previousEventIds: prev }
    );
    expect(clusters[0].eventId).toBe('evt_stable123');
  });

  it('does not reuse the same previous event_id across two split clusters', () => {
    const stale = 'evt_sharedstale01';
    const prev = new Map([
      ['h1', stale],
      ['h2', stale],
      ['v1', stale],
      ['v2', stale]
    ]);
    const clusters = mergeHotStories(
      [
        item({
          id: 'h1',
          title: 'Health A',
          source: 'S1',
          metadata: {
            event_signature: 'chatgpt-health-launch',
            entities: ['ChatGPT Health', 'OpenAI'],
            ai_summary_short: 'OpenAI 向全美用户推出 ChatGPT Health 医疗功能'
          }
        }),
        item({
          id: 'h2',
          title: 'Health B',
          source: 'S2',
          metadata: {
            event_signature: 'chatgpt-health-us',
            entities: ['ChatGPT Health', 'OpenAI'],
            ai_summary_short: 'OpenAI 向全美用户开放 ChatGPT Health'
          }
        }),
        item({
          id: 'v1',
          title: 'Voice A',
          source: 'S3',
          metadata: {
            event_signature: 'chatgpt-voice-desktop',
            entities: ['ChatGPT Voice', 'OpenAI', 'Codex'],
            ai_summary_short: 'OpenAI 在桌面端推出 ChatGPT Voice 语音控制'
          }
        }),
        item({
          id: 'v2',
          title: 'Voice B',
          source: 'S4',
          metadata: {
            event_signature: 'chatgpt-voice-agents',
            entities: ['ChatGPT Voice', 'OpenAI', 'Codex'],
            ai_summary_short: 'ChatGPT Voice 上线桌面端支持语音控制 agents'
          }
        })
      ],
      { previousEventIds: prev }
    );

    const ids = clusters.map((c) => c.eventId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === stale).length).toBeLessThanOrEqual(1);
  });
});

describe('similarity helpers', () => {
  it('folds entity aliases and computes overlaps', () => {
    expect(normalizeEntityToken('GPT-5')).toBe('gpt5');
    expect(entityJaccard(['OpenAI', 'GPT-5'], ['OpenAI', 'GPT5', 'X'])).toBeGreaterThanOrEqual(
      0.5
    );
    expect(titleTokenOverlap('OpenAI launches GPT-5', 'GPT-5 launched by OpenAI')).toBeGreaterThan(
      0.3
    );
  });
});
