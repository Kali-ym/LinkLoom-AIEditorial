import { describe, expect, it } from 'vitest';
import {
  bootstrapFingerprint,
  computeEntityOverlap,
  extractMiniProfile,
  judgmentCacheKey,
  onMerge,
  recallTopK,
  trySeal,
  type ClusterFingerprint,
  type ItemMiniProfile
} from '../src/services/feed/ClusterFingerprint.js';
import type { HotClusterItem } from '../src/services/feed/hotEvents.js';

function makeItem(
  id: string,
  opts: {
    signature?: string;
    entities?: string[];
    numbers?: string[];
    keyFacts?: string[];
    summary?: string;
    publishedAt?: string;
  }
): HotClusterItem {
  return {
    id,
    title: opts.summary || `Item ${id}`,
    source: 'test',
    published_date: opts.publishedAt || '2026-07-30T12:00:00.000Z',
    metadata: {
      event_signature: opts.signature || '',
      entities: opts.entities || [],
      numbers: opts.numbers || [],
      key_facts: opts.keyFacts || [],
      ai_summary_short: opts.summary || ''
    }
  };
}

function makeProfile(
  id: string,
  opts: {
    signature?: string;
    entities?: string[];
    numbers?: string[];
    keyFacts?: string[];
    summary?: string;
    publishedAt?: string;
  }
): ItemMiniProfile {
  return extractMiniProfile(makeItem(id, opts));
}

describe('ClusterFingerprint', () => {
  describe('extractMiniProfile', () => {
    it('extracts structured signals from a HotClusterItem', () => {
      const item = makeItem('a', {
        signature: 'Moonshot/Kimi K3 release',
        entities: ['Moonshot AI', 'Kimi K3'],
        numbers: ['1T'],
        keyFacts: ['开源权重'],
        summary: '月之暗面发布 Kimi K3 模型'
      });

      const profile = extractMiniProfile(item);
      expect(profile.itemId).toBe('a');
      expect(profile.signature).toBe('Moonshot/Kimi K3 release');
      expect(profile.entities).toEqual(['Moonshot AI', 'Kimi K3']);
      expect(profile.numbers).toEqual(['1T']);
      expect(profile.keyFacts).toEqual(['开源权重']);
      expect(profile.summaryShort).toBe('月之暗面发布 Kimi K3 模型');
      expect(profile.contentHash).toBeTruthy();
    });

    it('handles missing metadata gracefully', () => {
      const item: HotClusterItem = {
        id: 'b',
        title: 'Plain title',
        source: 'test',
        published_date: '2026-07-30T12:00:00.000Z'
      };

      const profile = extractMiniProfile(item);
      expect(profile.entities).toEqual([]);
      expect(profile.numbers).toEqual([]);
      expect(profile.keyFacts).toEqual([]);
      expect(profile.summaryShort).toBe('Plain title');
    });
  });

  describe('bootstrapFingerprint', () => {
    it('creates a fingerprint from seed member with zero LLM', () => {
      const profile = makeProfile('a', {
        signature: 'Moonshot/Kimi K3 release',
        entities: ['Moonshot AI', 'Kimi K3'],
        keyFacts: ['开源权重', 'API 减半'],
        summary: '月之暗面发布 Kimi K3'
      });

      const fp = bootstrapFingerprint('evt_001', profile);
      expect(fp.eventId).toBe('evt_001');
      expect(fp.seedFingerprint).toContain('Moonshot AI');
      expect(fp.seedFingerprint).toContain('Kimi K3');
      expect(fp.discriminators).toContain('月之暗面发布 Kimi K3');
      expect(fp.aliases).toHaveLength(2);
      expect(fp.pendingClaims).toHaveLength(2);
      expect(fp.pendingClaims[0].sources).toBe(1);
      expect(fp.memberCount).toBe(1);
      expect(fp.sealed).toBe(false);
    });

    it('handles empty entities', () => {
      const profile = makeProfile('a', {
        signature: 'some event',
        summary: 'A thing happened'
      });

      const fp = bootstrapFingerprint('evt_002', profile);
      expect(fp.seedFingerprint).toContain('some event');
      expect(fp.aliases).toHaveLength(0);
    });
  });

  describe('onMerge', () => {
    it('appends new aliases and accumulates pending claims', () => {
      const profile = makeProfile('a', {
        entities: ['Moonshot AI'],
        keyFacts: ['开源权重'],
        summary: 'Kimi K3 发布'
      });
      const fp = bootstrapFingerprint('evt_001', profile);

      // Second item with same entity + same fact
      const profile2 = makeProfile('b', {
        entities: ['Moonshot AI', 'Kimi K3'],
        keyFacts: ['开源权重', 'API 减半'],
        summary: 'Kimi K3 上线'
      });

      const { promoted } = onMerge(fp, profile2);

      // "开源权重" now has sources=2 → promoted
      expect(promoted).toContain('开源权重');
      expect(fp.discriminators).toContain('开源权重');
      expect(fp.aliases).toHaveLength(2); // Moonshot AI + Kimi K3
      expect(fp.memberCount).toBe(2);
      expect(fp.sealed).toBe(false); // promoted → unsealed
    });

    it('does not promote single-source claims', () => {
      const profile = makeProfile('a', {
        entities: ['EntityA'],
        keyFacts: ['fact1', 'fact2'],
        summary: 'Event A'
      });
      const fp = bootstrapFingerprint('evt_001', profile);

      const profile2 = makeProfile('b', {
        entities: ['EntityA'],
        keyFacts: ['fact2', 'fact3'], // fact2 gets source=2, fact3 stays at 1
        summary: 'Event A follow-up'
      });

      const { promoted } = onMerge(fp, profile2);
      expect(promoted).toEqual(['fact2']);
      expect(fp.discriminators).toContain('fact2');
      expect(fp.discriminators).not.toContain('fact3');
      expect(fp.pendingClaims.find((c) => c.claim === 'fact3')?.sources).toBe(1);
    });
  });

  describe('trySeal', () => {
    it('seals a cluster with no promotable claims after sealAfterMs', () => {
      const profile = makeProfile('a', {
        entities: ['E'],
        keyFacts: ['f'],
        summary: 'Event'
      });
      const fp = bootstrapFingerprint('evt_001', profile);
      fp.lastUpdated = new Date(Date.now() - 7 * 3600 * 1000).toISOString(); // 7h ago

      const sealed = trySeal(fp, 6 * 3600 * 1000);
      expect(sealed).toBe(true);
      expect(fp.sealed).toBe(true);
    });

    it('does not seal when there are promotable claims', () => {
      const profile = makeProfile('a', {
        entities: ['E'],
        keyFacts: ['f'],
        summary: 'Event'
      });
      const fp = bootstrapFingerprint('evt_001', profile);

      // Add a second source to make it promotable
      const profile2 = makeProfile('b', {
        entities: ['E'],
        keyFacts: ['f'],
        summary: 'Event follow-up'
      });
      onMerge(fp, profile2); // f now has sources=2

      fp.lastUpdated = new Date(Date.now() - 7 * 3600 * 1000).toISOString();
      const sealed = trySeal(fp, 6 * 3600 * 1000);
      expect(sealed).toBe(false);
    });
  });

  describe('computeEntityOverlap', () => {
    it('returns high overlap for matching entities', () => {
      const profile = makeProfile('a', {
        entities: ['Moonshot AI', 'Kimi K3']
      });
      const fp = bootstrapFingerprint('evt_001', profile);

      const profile2 = makeProfile('b', {
        entities: ['Moonshot AI', 'Kimi K3', '开源']
      });

      const overlap = computeEntityOverlap(profile2, fp);
      expect(overlap).toBeGreaterThan(0);
      expect(overlap).toBeLessThanOrEqual(1);
    });

    it('returns 0 for no entity overlap', () => {
      const profile = makeProfile('a', {
        entities: ['OpenAI']
      });
      const fp = bootstrapFingerprint('evt_001', profile);

      const profile2 = makeProfile('b', {
        entities: ['Google']
      });

      const overlap = computeEntityOverlap(profile2, fp);
      expect(overlap).toBe(0);
    });

    it('normalizes entity forms (spaces, case, separators)', () => {
      const profile = makeProfile('a', {
        entities: ['Kimi K3']
      });
      const fp = bootstrapFingerprint('evt_001', profile);

      const profile2 = makeProfile('b', {
        entities: ['kimi-k3']
      });

      const overlap = computeEntityOverlap(profile2, fp);
      expect(overlap).toBeGreaterThan(0);
    });
  });

  describe('recallTopK', () => {
    it('returns top-K clusters by entity overlap', () => {
      const fp1 = bootstrapFingerprint(
        'evt_001',
        makeProfile('a', { entities: ['Moonshot AI', 'Kimi K3'] })
      );
      const fp2 = bootstrapFingerprint(
        'evt_002',
        makeProfile('b', { entities: ['OpenAI', 'GPT-5'] })
      );
      const fp3 = bootstrapFingerprint(
        'evt_003',
        makeProfile('c', { entities: ['Google', 'Gemini'] })
      );

      const item = makeProfile('d', {
        entities: ['Moonshot AI', 'Kimi K3', 'Something Else']
      });

      const result = recallTopK(item, [fp1, fp2, fp3], 36 * 3600 * 1000, 3);
      expect(result[0].eventId).toBe('evt_001');
    });

    it('skips clusters with zero entity overlap', () => {
      const fp1 = bootstrapFingerprint(
        'evt_001',
        makeProfile('a', { entities: ['OpenAI'] })
      );

      const item = makeProfile('d', {
        entities: ['Google', 'Gemini']
      });

      const result = recallTopK(item, [fp1], 36 * 3600 * 1000, 3);
      expect(result).toHaveLength(0);
    });
  });

  describe('judgmentCacheKey', () => {
    it('produces different keys for different items', () => {
      const fp = bootstrapFingerprint(
        'evt_001',
        makeProfile('a', { entities: ['E'] })
      );

      const p1 = makeProfile('a', { entities: ['E'] });
      const p2 = makeProfile('b', { entities: ['E'] });

      expect(judgmentCacheKey(p1, fp)).not.toBe(judgmentCacheKey(p2, fp));
    });

    it('produces different keys for different fingerprints', () => {
      const profile = makeProfile('a', { entities: ['E'] });

      const fp1 = bootstrapFingerprint('evt_001', profile);
      const fp2 = bootstrapFingerprint('evt_002', profile);

      expect(judgmentCacheKey(profile, fp1)).not.toBe(judgmentCacheKey(profile, fp2));
    });
  });
});
