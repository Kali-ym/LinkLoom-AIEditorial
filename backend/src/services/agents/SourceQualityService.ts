import type { UnifiedData } from '../../types/index.js';
import { resolveSourceTier, getSourceTierWeight } from '../../config/sourceTierMap.js';
import type { SourceTierSetting } from '../../types/config.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';

const CONFIG_KEY = 'platform_source_quality';

export interface SourceQualityConfig {
  sourceBlacklist: string[];
  sourceWhitelist: string[];
  minAiScore: number;
  blockedTiers: SourceTierSetting[];
  demoteLowTier: boolean;
  updatedAt?: string;
}

export interface SourceQualityStatus extends SourceQualityConfig {
  enabled: boolean;
  filteredLast24h?: number;
}

const DEFAULT_CONFIG: SourceQualityConfig = {
  sourceBlacklist: [],
  sourceWhitelist: [],
  minAiScore: 0,
  blockedTiers: [],
  demoteLowTier: false
};

export class SourceQualityService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async getConfig(): Promise<SourceQualityConfig> {
    const stored = await this.store.get(CONFIG_KEY);
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_CONFIG };
    return normalizeConfig(stored as Partial<SourceQualityConfig>);
  }

  async getStatus(): Promise<SourceQualityStatus> {
    const config = await this.getConfig();
    return {
      ...config,
      enabled: isEnabled(config)
    };
  }

  async updateConfig(patch: Partial<SourceQualityConfig> & Record<string, unknown>): Promise<SourceQualityConfig> {
    const current = await this.getConfig();
    const next = normalizeConfig({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    });
    await this.store.put(CONFIG_KEY, next);
    return next;
  }

  async loadConfigForFilter(): Promise<SourceQualityConfig> {
    const fromKv = await this.getConfig();
    if (isEnabled(fromKv)) return fromKv;
    const fromSettings = this.context.settings?.PLATFORM_SOURCE_QUALITY as
      | Partial<SourceQualityConfig>
      | undefined;
    if (fromSettings && typeof fromSettings === 'object') {
      return normalizeConfig({ ...DEFAULT_CONFIG, ...fromSettings });
    }
    return fromKv;
  }

  isAllowed(item: UnifiedData, config?: SourceQualityConfig): boolean {
    const cfg = config ?? DEFAULT_CONFIG;
    if (!isEnabled(cfg)) return true;
    const tierOverrides = this.context.settings?.EDITORIAL_CONFIG?.sourceTierOverrides;
    return isAllowedItem(item, cfg, tierOverrides);
  }
}

export async function applySourceQualityFilter(
  store: LocalStore,
  items: UnifiedData[]
): Promise<UnifiedData[]> {
  const stored = await store.get(CONFIG_KEY);
  let config = stored && typeof stored === 'object'
    ? normalizeConfig(stored as Partial<SourceQualityConfig>)
    : { ...DEFAULT_CONFIG };
  if (!isEnabled(config)) {
    const settings = (await store.get('system_settings')) as Record<string, unknown> | undefined;
    const fromSettings = settings?.PLATFORM_SOURCE_QUALITY;
    if (fromSettings && typeof fromSettings === 'object') {
      config = normalizeConfig({ ...DEFAULT_CONFIG, ...(fromSettings as Partial<SourceQualityConfig>) });
    }
  }
  if (!isEnabled(config)) return items;

  const tierOverrides = (
    (await store.get('system_settings')) as { EDITORIAL_CONFIG?: { sourceTierOverrides?: Record<string, SourceTierSetting> } }
  )?.EDITORIAL_CONFIG?.sourceTierOverrides;

  return items.filter((item) => isAllowedItem(item, config, tierOverrides));
}

function isAllowedItem(
  item: UnifiedData,
  config: SourceQualityConfig,
  tierOverrides?: Record<string, SourceTierSetting>
): boolean {
  const sourceKey = normalizeSourceKey(item.source, item.url);
  if (config.sourceBlacklist.some((entry) => matchesSourceEntry(sourceKey, entry))) return false;
  if (config.sourceWhitelist.length > 0) {
    if (!config.sourceWhitelist.some((entry) => matchesSourceEntry(sourceKey, entry))) return false;
  }
  const score = readAiScore(item.metadata);
  if (config.minAiScore > 0 && score != null && score < config.minAiScore) return false;
  const tier = resolveSourceTier(item.url, item.source, undefined, tierOverrides);
  if (config.blockedTiers.includes(tier)) return false;
  if (config.demoteLowTier && getSourceTierWeight(tier) <= 1 && score != null && score < 60) return false;
  return true;
}

function isEnabled(config: SourceQualityConfig): boolean {
  return (
    config.sourceBlacklist.length > 0 ||
    config.sourceWhitelist.length > 0 ||
    config.minAiScore > 0 ||
    config.blockedTiers.length > 0 ||
    config.demoteLowTier
  );
}

function normalizeConfig(raw: Partial<SourceQualityConfig>): SourceQualityConfig {
  return {
    sourceBlacklist: normalizeStringList(raw.sourceBlacklist),
    sourceWhitelist: normalizeStringList(raw.sourceWhitelist),
    minAiScore: clampScore(raw.minAiScore),
    blockedTiers: normalizeTierList(raw.blockedTiers),
    demoteLowTier: raw.demoteLowTier === true,
    updatedAt: raw.updatedAt
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
}

function normalizeTierList(value: unknown): SourceTierSetting[] {
  const allowed = new Set<SourceTierSetting>([
    'official',
    'mainstream',
    'community',
    'aggregator',
    'unknown'
  ]);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SourceTierSetting => allowed.has(item as SourceTierSetting));
}

function clampScore(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, Math.floor(num)));
}

function readAiScore(metadata: UnifiedData['metadata']): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const score = Number((metadata as Record<string, unknown>).ai_score);
  return Number.isFinite(score) ? score : null;
}

function normalizeSourceKey(source?: string, url?: string): string {
  let host = '';
  try {
    if (url) host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    /* ignore */
  }
  return `${String(source || '').toLowerCase()} ${host}`.trim();
}

function matchesSourceEntry(sourceKey: string, entry: string): boolean {
  const needle = entry.trim().toLowerCase();
  if (!needle) return false;
  return sourceKey.includes(needle);
}
