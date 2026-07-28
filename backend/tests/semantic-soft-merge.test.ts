import { describe, expect, it } from 'vitest';
import type { HotClusterItem } from '../src/services/feed/hotEvents.js';
import { mergeHotStories, finalizeClusters } from '../src/services/feed/mergeHotStories.js';
import {
  isEmbeddingCandidate,
  softMergeByEmbedding
} from '../src/services/feed/semanticSoftMerge.js';

function item(partial: Partial<HotClusterItem> & { id: string; title: string }): HotClusterItem {
  return {
    source: 'Source',
    published_date: '2026-07-21T12:00:00.000Z',
    ...partial
  };
}

/** Deterministic fake embedder: maps known Chinese shorts to orthogonal-ish vectors. */
function fakeEmbed(map: Record<string, number[]>): (texts: string[]) => Promise<number[][]> {
  return async (texts) =>
    texts.map((t) => {
      const key = t.trim();
      if (map[key]) return map[key];
      // default: hash-ish unique direction
      const v = new Array(4).fill(0);
      v[key.length % 4] = 1;
      return v;
    });
}

describe('semantic / hybrid soft-merge', () => {
  it('embedding pass merges near neighbors that rules left split', async () => {
    const a = item({
      id: 'c1',
      title: 'Claude voice Opus',
      source: 'Verge',
      metadata: {
        event_signature: 'claude-voice-opus',
        entities: ['Anthropic', 'Claude', 'Opus'],
        ai_summary_short: 'Anthropic 将 Claude 语音扩展到 Opus'
      }
    });
    const b = item({
      id: 'c2',
      title: 'Claude voice upgrade',
      source: 'TC',
      metadata: {
        event_signature: 'claude-voice-upgrade',
        entities: ['Anthropic', 'Claude'],
        ai_summary_short: 'Anthropic 升级 Claude 语音模式支持更强模型'
      }
    });

    const rulesOnly = mergeHotStories([a, b], { softMerge: 'rules' });
    // May or may not merge under rules; force hard-only then embedding
    const hard = mergeHotStories([a, b], { softMerge: 'none' });
    expect(hard.length).toBe(2);

    const near = [0.9, 0.1, 0, 0];
    const embed = fakeEmbed({
      'Anthropic 将 Claude 语音扩展到 Opus': near,
      'Anthropic 升级 Claude 语音模式支持更强模型': [0.88, 0.12, 0, 0]
    });

    const merged = await softMergeByEmbedding(
      hard.map((c) => ({ signatureNorm: c.signatureNorm, members: c.members })),
      embed,
      0.78,
      { requireCandidateFilter: true }
    );
    expect(merged).not.toBeNull();
    expect(merged!).toHaveLength(1);
    expect(finalizeClusters(merged!).length).toBe(1);
    expect(rulesOnly.length).toBeGreaterThanOrEqual(1);
  });

  it('does not embed-merge low-info broadcast into health story', async () => {
    const health = item({
      id: 'h',
      title: 'ChatGPT Health',
      source: 'TC',
      metadata: {
        event_signature: 'health',
        entities: ['OpenAI', 'ChatGPT Health'],
        ai_summary_short: 'OpenAI 向全美用户开放 ChatGPT Health'
      }
    });
    const bcast = item({
      id: 'b',
      title: 'broadcast',
      source: 'Devs',
      metadata: {
        event_signature: 'bcast',
        entities: ['OpenAI'],
        ai_summary_short: 'OpenAI Developers 发起广播直播'
      }
    });
    expect(
      isEmbeddingCandidate(
        { signatureNorm: null, members: [health] },
        { signatureNorm: null, members: [bcast] }
      )
    ).toBe(false);

    const hard = mergeHotStories([health, bcast], { softMerge: 'none' });
    const same = [1, 0, 0, 0];
    const embed = fakeEmbed({
      'OpenAI 向全美用户开放 ChatGPT Health': same,
      'OpenAI Developers 发起广播直播': same
    });
    const merged = await softMergeByEmbedding(
      hard.map((c) => ({ signatureNorm: c.signatureNorm, members: c.members })),
      embed,
      0.5,
      { requireCandidateFilter: false }
    );
    // low-info guard inside softMergeByEmbedding
    expect(merged).toHaveLength(2);
  });

  it('returns null when embedder fails', async () => {
    const a = item({
      id: 'a',
      title: 'A',
      metadata: { event_signature: 'a', entities: ['X'], ai_summary_short: '事件甲发生了' }
    });
    const b = item({
      id: 'b',
      title: 'B',
      metadata: { event_signature: 'b', entities: ['X'], ai_summary_short: '事件乙发生了' }
    });
    const hard = mergeHotStories([a, b], { softMerge: 'none' });
    const merged = await softMergeByEmbedding(
      hard.map((c) => ({ signatureNorm: c.signatureNorm, members: c.members })),
      async () => null,
      0.78
    );
    expect(merged).toBeNull();
  });
});
