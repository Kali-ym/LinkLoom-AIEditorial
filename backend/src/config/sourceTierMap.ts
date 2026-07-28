import type { SourceTierSetting } from '../types/config.js';
import type { SourceTier } from '../types/dailyEditorial.js';

const OFFICIAL_DOMAINS = [
  'openai.com',
  'anthropic.com',
  'googleblog.com',
  'blog.google',
  'ai.meta.com',
  'meta.com',
  'microsoft.com',
  'github.com',
  'arxiv.org',
  'huggingface.co',
  'nvidia.com',
  'aws.amazon.com',
  'cloud.google.com',
  'azure.microsoft.com'
];

const MAINSTREAM_DOMAINS = [
  'reuters.com',
  'bloomberg.com',
  'theverge.com',
  'techcrunch.com',
  'wired.com',
  'arstechnica.com',
  '36kr.com',
  'jiqizhixin.com',
  'qbitai.com',
  'ithome.com'
];

const AGGREGATOR_DOMAINS = ['rsshub.app', 'feedx.net', 'toutiao.io', 'sspai.com'];

const SOURCE_TIER_WEIGHT: Record<SourceTier, number> = {
  official: 4,
  mainstream: 3,
  community: 2,
  aggregator: 1,
  unknown: 1.5
};

export function getSourceTierWeight(tier: SourceTier): number {
  return SOURCE_TIER_WEIGHT[tier] ?? 1;
}

const VALID_TIERS = new Set<SourceTier>([
  'official',
  'mainstream',
  'community',
  'aggregator',
  'unknown'
]);

function tierFromOverrides(
  host: string,
  overrides?: Record<string, SourceTierSetting>
): SourceTier | null {
  if (!overrides || !host) return null;
  for (const [domain, tier] of Object.entries(overrides)) {
    const d = domain.toLowerCase().replace(/^www\./, '');
    if (!d || !VALID_TIERS.has(tier)) continue;
    if (host === d || host.endsWith(`.${d}`)) {
      return tier;
    }
  }
  return null;
}

/** 从 URL、source 字段、adapterId 推断来源分级 */
export function resolveSourceTier(
  url?: string,
  source?: string,
  adapterId?: string,
  overrides?: Record<string, SourceTierSetting>
): SourceTier {
  const haystack = `${url || ''} ${source || ''} ${adapterId || ''}`.toLowerCase();
  let host = '';
  try {
    if (url) host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* ignore */
  }

  const overrideTier = tierFromOverrides(host, overrides);
  if (overrideTier) return overrideTier;

  const matchDomain = (domains: string[]) =>
    domains.some((d) => host === d || host.endsWith(`.${d}`) || haystack.includes(d));

  if (matchDomain(OFFICIAL_DOMAINS)) return 'official';
  if (matchDomain(MAINSTREAM_DOMAINS)) return 'mainstream';
  if (matchDomain(AGGREGATOR_DOMAINS)) return 'aggregator';
  if (
    haystack.includes('twitter.com') ||
    haystack.includes('x.com') ||
    haystack.includes('weibo')
  ) {
    return 'community';
  }
  return 'unknown';
}

export function pickHigherSourceTier(a: SourceTier, b: SourceTier): SourceTier {
  return getSourceTierWeight(a) >= getSourceTierWeight(b) ? a : b;
}
