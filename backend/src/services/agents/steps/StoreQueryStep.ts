import type { MetadataFilter, MetadataFilterOp } from '../../../domain/ports/store.js';
import type { UnifiedData } from '../../../types/index.js';
import { applySourceQualityFilter } from '../SourceQualityService.js';
import { LogService } from '../../LogService.js';
import { getByPath, renderTemplate } from '../workflowExpressions.js';
import type { WorkflowStepTypeDefinition } from './StepCatalog.js';
import type { StepExecutionContext, StepExecutor } from './StepRegistry.js';

interface StoreQueryFilter {
  category?: string[];
  source?: string[];
  adapterName?: string;
  sinceHours?: number;
  ingestionDate?: string;
  ingestionDates?: string[];
  dailyCandidate?: string;
  metadataFilters?: MetadataFilter[];
}

interface StoreQueryStepConfig {
  filter?: StoreQueryFilter;
  limit?: number;
  orderBy?: 'publishedDesc' | 'fetchedDesc' | 'metadataDesc' | 'metadataAsc';
  orderMetadataPath?: string;
  mergeCandidates?: boolean;
}

const STORE_QUERY_ORDER_OPTIONS = [
  { value: 'fetchedDesc', label: '按抓取时间（新→旧）' },
  { value: 'publishedDesc', label: '按发布时间（新→旧）' },
  { value: 'metadataDesc', label: '按 metadata 数值（高→低）' },
  { value: 'metadataAsc', label: '按 metadata 数值（低→高）' }
];

const METADATA_FILTER_OPS = new Set<MetadataFilterOp>([
  'exists',
  'notExists',
  'eq',
  'ne',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte'
]);

export const storeQueryStepExecutor: StepExecutor = async (ctx) => {
  const cfg = resolveConfig(ctx);
  const filter = cfg.filter || {};
  const limit = Math.max(1, Math.min(1000, cfg.limit || 200));
  const orderBy = cfg.orderBy || 'fetchedDesc';

  LogService.info(
    `[Step:store-query] filter=${JSON.stringify(filter)} limit=${limit} orderBy=${orderBy}`
  );

  const collected = new Map<string, UnifiedData>();

  const sources: Array<string | undefined> =
    filter.source && filter.source.length > 0 ? filter.source : [undefined];
  const categories: Array<string | undefined> =
    filter.category && filter.category.length > 0 ? filter.category : [undefined];

  for (const source of sources) {
    for (const category of categories) {
      const queryOpts: Parameters<typeof ctx.store.listSourceData>[0] = {
        source,
        category,
        adapterName: filter.adapterName,
        ingestionDate: filter.ingestionDate,
        ingestionDates: filter.ingestionDates,
        dailyCandidate: filter.dailyCandidate,
        metadataFilters: filter.metadataFilters,
        limit: Math.min(1000, limit * 4),
        orderByPublishedDesc: orderBy === 'publishedDesc'
      };
      const { items } = await ctx.store.listSourceData(queryOpts);
      for (const item of items) {
        if (!matchesExtraFilters(item, filter)) continue;
        if (!collected.has(item.id)) {
          collected.set(item.id, item);
        }
        if (collected.size >= limit) break;
      }
      if (collected.size >= limit) break;
    }
    if (collected.size >= limit) break;
  }

  if (cfg.mergeCandidates && filter.ingestionDate) {
    const { items } = await ctx.store.listSourceData({
      dailyCandidate: filter.ingestionDate,
      limit: Math.min(1000, limit * 2)
    });
    for (const item of items) {
      if (!collected.has(item.id)) {
        collected.set(item.id, item);
        if (collected.size >= limit) break;
      }
    }
  }

  const all = Array.from(collected.values());
  const sorted = sortItems(all, cfg);
  const qualityFiltered = await applySourceQualityFilter(ctx.store, sorted);
  const items = qualityFiltered.slice(0, limit);

  ctx.emit?.({
    type: 'step_progress',
    stepId: ctx.step.id,
    displayName: ctx.step.displayName || ctx.step.id,
    message: `查询到 ${items.length} 条候选`
  });

  return {
    items,
    total: items.length,
    query: { filter, limit, orderBy, orderMetadataPath: cfg.orderMetadataPath }
  };
};

function resolveConfig(ctx: StepExecutionContext): StoreQueryStepConfig {
  const baseCfg = ctx.step.config || {};
  const rendered = renderTemplate(baseCfg, {
    ...ctx.stepResults,
    input: ctx.resolvedInput,
    current: ctx.resolvedInput,
    __date: ctx.date
  }) as Record<string, unknown>;
  const input =
    ctx.resolvedInput && typeof ctx.resolvedInput === 'object' && !Array.isArray(ctx.resolvedInput)
      ? (ctx.resolvedInput as Record<string, unknown>)
      : {};

  const filter = resolveStoreQueryFilter(baseCfg, rendered, input);

  return {
    filter,
    limit:
      (rendered.limit as number) ?? (input.limit as number) ?? (input.maxItems as number) ?? 200,
    orderBy:
      (rendered.orderBy as StoreQueryStepConfig['orderBy']) ??
      (input.orderBy as StoreQueryStepConfig['orderBy']) ??
      'fetchedDesc',
    orderMetadataPath:
      (rendered.orderMetadataPath as string) ?? (input.orderMetadataPath as string) ?? undefined,
    mergeCandidates:
      (rendered.mergeCandidates as boolean) ?? (input.mergeCandidates as boolean) ?? false
  };
}

function resolveStoreQueryFilter(
  baseCfg: Record<string, unknown>,
  rendered: Record<string, unknown>,
  input: Record<string, unknown>
): StoreQueryFilter | undefined {
  const staticFilter = asFilterObject(baseCfg.filter);
  const renderedFilter = asFilterObject(rendered.filter);
  const inputFilter = asFilterObject(input.filter);

  if (staticFilter) {
    return { ...inputFilter, ...renderedFilter };
  }
  if (renderedFilter) return renderedFilter;
  if (inputFilter) return inputFilter;
  return undefined;
}

function asFilterObject(value: unknown): StoreQueryFilter | undefined {
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('$.') || s.startsWith('${')) return undefined;
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return normalizeStoreQueryFilter(value as Record<string, unknown>);
}

function normalizeStoreQueryFilter(value: Record<string, unknown>): StoreQueryFilter {
  return {
    ...(value as StoreQueryFilter),
    metadataFilters: normalizeMetadataFilters(value.metadataFilters)
  };
}

function normalizeMetadataFilters(value: unknown): MetadataFilter[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filters = value.flatMap((item): MetadataFilter[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const candidate = item as { path?: unknown; op?: unknown; value?: unknown };
    if (typeof candidate.path !== 'string' || candidate.path.trim() === '') return [];
    if (candidate.op !== undefined && !isMetadataFilterOp(candidate.op)) return [];
    return [
      {
        path: candidate.path,
        op: candidate.op,
        value: candidate.value
      }
    ];
  });
  return filters.length > 0 ? filters : undefined;
}

function isMetadataFilterOp(value: unknown): value is MetadataFilterOp {
  return typeof value === 'string' && METADATA_FILTER_OPS.has(value as MetadataFilterOp);
}

function matchesExtraFilters(item: UnifiedData, filter: StoreQueryFilter): boolean {
  if (filter.sinceHours && filter.sinceHours > 0) {
    const cutoff = Date.now() - filter.sinceHours * 3600_000;
    const fetchedAt = (item as any).fetched_at as number | undefined;
    const ts = fetchedAt ?? Date.parse(item.published_date);
    if (Number.isFinite(ts) && ts < cutoff) return false;
  }
  return true;
}

export const storeQueryStepDefinition: WorkflowStepTypeDefinition = {
  type: 'store-query',
  label: '库内查询',
  icon: 'database',
  color: 'emerald',
  category: 'pipeline',
  description: '从 source_data 按条件取出条目，输出 { items, total }。',
  defaultConfig: {
    filter: {
      metadataFilters: [],
      sinceHours: 0
    },
    limit: 200,
    orderBy: 'fetchedDesc'
  },
  configSchema: {
    fields: [
      {
        key: 'filter.category',
        label: '内容分类',
        type: 'string-array',
        description: '按 source_data.category 精确匹配，逗号分隔。',
        group: '筛选条件'
      },
      {
        key: 'filter.source',
        label: '指定来源名',
        type: 'string-array',
        description: '按 source_data.source 精确匹配，逗号分隔。',
        group: '筛选条件'
      },
      {
        key: 'filter.adapterName',
        label: '采集适配器名',
        type: 'string',
        description: '只取此适配器抓回的条目。',
        group: '筛选条件'
      },
      {
        key: 'filter.metadataFilters',
        label: 'metadata 条件',
        type: 'json',
        default: [],
        description: '通用 metadata 条件数组，例如 [{"path":"field","op":"exists"}]。',
        group: '筛选条件'
      },
      {
        key: 'filter.sinceHours',
        label: '最近 N 小时内',
        type: 'number',
        min: 0,
        description: '0 表示不限制。',
        group: '筛选条件'
      },
      {
        key: 'filter.ingestionDate',
        label: '入库日期',
        type: 'date',
        description: '只取该日入库的条目。',
        allowVariables: true,
        group: '筛选条件'
      },
      {
        key: 'filter',
        label: '直接用工作流入参 filter',
        type: 'json',
        description: '高级：把整张 filter 设为表达式（如 $.input.filter）。',
        allowVariables: true,
        group: '筛选条件（高级）'
      },
      {
        key: 'limit',
        label: '单次上限',
        type: 'number',
        default: 200,
        min: 1,
        max: 1000,
        allowVariables: true,
        group: '运行策略'
      },
      {
        key: 'orderBy',
        label: '排序',
        type: 'select',
        default: 'fetchedDesc',
        options: STORE_QUERY_ORDER_OPTIONS,
        group: '运行策略'
      },
      {
        key: 'orderMetadataPath',
        label: 'metadata 排序字段',
        type: 'string',
        description: '当排序选择 metadataAsc/metadataDesc 时读取该 metadata 路径。',
        allowVariables: true,
        group: '运行策略'
      },
      {
        key: 'mergeCandidates',
        label: '合并候选池',
        type: 'boolean',
        description: '与入库日期配合，把候选池命中的条目也加入结果。',
        group: '运行策略'
      }
    ]
  },
  executor: storeQueryStepExecutor
};

function sortItems(items: UnifiedData[], cfg: StoreQueryStepConfig): UnifiedData[] {
  const orderBy = cfg.orderBy || 'fetchedDesc';
  const copy = items.slice();
  copy.sort((a, b) => {
    if (orderBy === 'metadataAsc' || orderBy === 'metadataDesc') {
      const path = cfg.orderMetadataPath || '';
      const av = Number(getByPath(a.metadata || {}, path));
      const bv = Number(getByPath(b.metadata || {}, path));
      const out = Number.isFinite(av) && Number.isFinite(bv) ? av - bv : 0;
      return orderBy === 'metadataDesc' ? -out : out;
    }
    if (orderBy === 'publishedDesc') {
      return (b.published_date || '').localeCompare(a.published_date || '');
    }
    const fa = (a.metadata?.fetched_at as number) ?? 0;
    const fb = (b.metadata?.fetched_at as number) ?? 0;
    return fb - fa;
  });
  return copy;
}
