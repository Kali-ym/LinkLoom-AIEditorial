import { defaultSettings } from '../config.js';
import type {
  AdapterConfig,
  AIProviderConfig,
  EditorialConfig,
  HotConfig,
  HotMergeMode,
  PublisherConfig,
  StorageConfig,
  SystemSettings
} from '../types/config.js';

const ADAPTER_TYPES = new Set([
  'GitHubTrendingAdapter',
  'FollowApiAdapter',
  'AISearchAdapter',
  'RSSAdapter'
]);
const AI_PROVIDER_TYPES = new Set(['GEMINI', 'CLAUDE', 'OPENAI', 'GLM', 'OLLAMA']);

/** Legacy keys removed from schema; strip on normalize so DB blobs do not keep them forever. */
const REMOVED_TOP_LEVEL_KEYS = [
  'IMAGE_PROCESS_CONFIG',
  'GLOBAL_GITHUB_TOKEN',
  'ARK_API_KEY'
] as const;

function asArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function normalizeAiProviders(value: unknown): AIProviderConfig[] {
  return asArray<AIProviderConfig>(value, defaultSettings.AI_PROVIDERS).filter(
    (provider) =>
      provider && typeof provider.id === 'string' && AI_PROVIDER_TYPES.has(provider.type)
  );
}

function normalizeAdapters(value: unknown, closedAdapterTypes: string[] = []): AdapterConfig[] {
  const closed = new Set(closedAdapterTypes);
  return asArray<AdapterConfig>(value, defaultSettings.ADAPTERS)
    .filter(
      (adapter) =>
        adapter &&
        typeof adapter.id === 'string' &&
        typeof adapter.adapterType === 'string' &&
        ADAPTER_TYPES.has(adapter.adapterType) &&
        !closed.has(adapter.adapterType)
    )
    .map((adapter) => ({
      ...adapter,
      items: Array.isArray(adapter.items) ? adapter.items : []
    }));
}

function normalizeEditorialConfig(value: unknown): EditorialConfig {
  const base = defaultSettings.EDITORIAL_CONFIG!;
  const raw = value && typeof value === 'object' ? (value as Partial<EditorialConfig>) : {};
  const mode =
    raw.defaultEditorialMode === 'conservative' || raw.defaultEditorialMode === 'standard'
      ? raw.defaultEditorialMode
      : base.defaultEditorialMode;
  const threshold = Number(raw.titleDedupThreshold);
  const overrides =
    raw.sourceTierOverrides && typeof raw.sourceTierOverrides === 'object'
      ? raw.sourceTierOverrides
      : {};
  const lookback = Number(raw.crossDayLookbackDays);
  const crossTitle = Number(raw.crossDayTitleSimilarityThreshold);
  return {
    titleDedupThreshold: Number.isFinite(threshold)
      ? Math.min(1, Math.max(0.5, threshold))
      : base.titleDedupThreshold,
    defaultEditorialMode: mode,
    sourceTierOverrides: overrides,
    crossDayLookbackDays: Number.isFinite(lookback)
      ? Math.min(30, Math.max(1, Math.floor(lookback)))
      : (base.crossDayLookbackDays ?? 7),
    crossDayUrlHardDrop:
      raw.crossDayUrlHardDrop !== undefined
        ? Boolean(raw.crossDayUrlHardDrop)
        : base.crossDayUrlHardDrop !== false,
    crossDayTitleSimilarityThreshold: Number.isFinite(crossTitle)
      ? Math.min(1, Math.max(0.5, crossTitle))
      : (base.crossDayTitleSimilarityThreshold ?? base.titleDedupThreshold),
    ingestToMemoryOnPublish:
      raw.ingestToMemoryOnPublish !== undefined
        ? Boolean(raw.ingestToMemoryOnPublish)
        : base.ingestToMemoryOnPublish === true,
    ingestToKnowledgeOnPublish:
      raw.ingestToKnowledgeOnPublish !== undefined
        ? Boolean(raw.ingestToKnowledgeOnPublish)
        : base.ingestToKnowledgeOnPublish !== false,
    knowledgeCategoryName:
      typeof raw.knowledgeCategoryName === 'string' && raw.knowledgeCategoryName.trim()
        ? raw.knowledgeCategoryName.trim()
        : base.knowledgeCategoryName || 'AI资讯日报',
    memoryCategoryName:
      typeof raw.memoryCategoryName === 'string' && raw.memoryCategoryName.trim()
        ? raw.memoryCategoryName.trim()
        : base.memoryCategoryName || '日报跨日索引',
    knowledgeCategoryId:
      typeof raw.knowledgeCategoryId === 'string'
        ? raw.knowledgeCategoryId
        : base.knowledgeCategoryId,
    memoryCategoryId:
      typeof raw.memoryCategoryId === 'string' ? raw.memoryCategoryId : base.memoryCategoryId
  };
}

function normalizeHotConfig(value: unknown): HotConfig {
  const base = defaultSettings.HOT_CONFIG!;
  const raw = value && typeof value === 'object' ? (value as Partial<HotConfig>) : {};
  const modeRaw = String(raw.mergeMode || base.mergeMode);
  const mergeMode: HotMergeMode =
    modeRaw === 'rules' || modeRaw === 'semantic' || modeRaw === 'hybrid'
      ? modeRaw
      : base.mergeMode;
  const sim = Number(raw.similarityMin);
  return {
    mergeMode,
    embeddingServiceId:
      typeof raw.embeddingServiceId === 'string'
        ? raw.embeddingServiceId.trim()
        : base.embeddingServiceId,
    similarityMin: Number.isFinite(sim)
      ? Math.min(0.99, Math.max(0.5, sim))
      : base.similarityMin
  };
}

function normalizePluginConfigs<T extends PublisherConfig | StorageConfig>(
  value: unknown,
  fallback: T[]
): T[] {
  return asArray<T>(value, fallback)
    .filter((config) => config && typeof config.id === 'string')
    .map((config) => ({
      ...config,
      enabled: Boolean(config.enabled),
      config: config.config && typeof config.config === 'object' ? config.config : {}
    }));
}

export function normalizeSettings(raw?: Partial<SystemSettings> | null): SystemSettings {
  const merged: SystemSettings = {
    ...defaultSettings,
    ...(raw || {})
  };

  for (const key of REMOVED_TOP_LEVEL_KEYS) {
    delete (merged as Record<string, unknown>)[key];
  }

  const closedPlugins = Array.from(
    new Set([
      ...(defaultSettings.CLOSED_PLUGINS || []),
      ...(Array.isArray(merged.CLOSED_PLUGINS) ? merged.CLOSED_PLUGINS : [])
    ])
  );

  return {
    ...merged,
    ACTIVE_AI_PROVIDER_ID: merged.ACTIVE_AI_PROVIDER_ID || defaultSettings.ACTIVE_AI_PROVIDER_ID,
    AI_PROVIDERS: normalizeAiProviders(merged.AI_PROVIDERS),
    PUBLISHERS: normalizePluginConfigs<PublisherConfig>(
      merged.PUBLISHERS,
      defaultSettings.PUBLISHERS
    ),
    STORAGES: normalizePluginConfigs<StorageConfig>(merged.STORAGES, defaultSettings.STORAGES),
    ADAPTERS: normalizeAdapters(merged.ADAPTERS, closedPlugins),
    CLOSED_PLUGINS: closedPlugins,
    CATEGORIES: Array.isArray(merged.CATEGORIES) ? merged.CATEGORIES : defaultSettings.CATEGORIES,
    SELECTION_FETCH_DAYS: Number.isFinite(Number(merged.SELECTION_FETCH_DAYS))
      ? Number(merged.SELECTION_FETCH_DAYS)
      : defaultSettings.SELECTION_FETCH_DAYS,
    SELECTION_QUERY_FIELD:
      merged.SELECTION_QUERY_FIELD === 'ingestion_date' ||
      merged.SELECTION_QUERY_FIELD === 'published_date'
        ? merged.SELECTION_QUERY_FIELD
        : defaultSettings.SELECTION_QUERY_FIELD,
    EDITORIAL_CONFIG: normalizeEditorialConfig(merged.EDITORIAL_CONFIG),
    HOT_CONFIG: normalizeHotConfig(merged.HOT_CONFIG)
  };
}
