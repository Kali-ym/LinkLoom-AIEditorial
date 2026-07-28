import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import type { SourceTierSetting } from '../../../types/config.js';
import { deduplicatePipelineItems, normalizeUrlForDedup } from '../../../utils/editorialUtils.js';
import { parseJsonLenient } from '../../../utils/helpers.js';
import { BaseTool } from '../../base/BaseTool.js';

function parseItemsInput(input: unknown): Record<string, unknown>[] {
  if (typeof input === 'string') {
    const parsed = parseJsonLenient(input);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { items?: unknown[] }).items)
    ) {
      return (parsed as { items: Record<string, unknown>[] }).items;
    }
    throw new Error('items must be a JSON array, { items }, or JSON string');
  }
  if (Array.isArray(input)) return input as Record<string, unknown>[];
  if (input && typeof input === 'object' && Array.isArray((input as { items?: unknown[] }).items)) {
    return (input as { items: Record<string, unknown>[] }).items;
  }
  throw new Error('items must be an array or { items }');
}

function copyField(item: Record<string, unknown>, from: string, to: string) {
  if (from === to || item[to] !== undefined) return;
  item[to] = item[from];
}

export class DeduplicateItemsTool extends BaseTool {
  readonly id = 'deduplicate_items';
  readonly name = 'deduplicate_items';
  readonly displayName = '素材去重';
  readonly scope = 'workflow' as const;
  readonly description =
    '对素材数组按 URL 与标题相似度去重，支持字段别名与历史 URL 过滤。日报/工作流素材清洗步骤中调用。' +
    '必填：items（数组、{ items } 或 JSON 字符串）；可选 urlField、titleField、historicalUrls。';
  readonly parameters = {
    type: 'object',
    properties: {
      items: { description: 'Item array, { items }, or JSON string' },
      urlField: { type: 'string', description: 'URL field name, default url' },
      titleField: { type: 'string', description: 'Title field name, default title' },
      orderField: { type: 'string', description: 'Sort/order field name, default selectedOrder' },
      titleThreshold: {
        type: 'number',
        description: 'Title similarity threshold, default settings or 0.92'
      },
      historicalUrls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Normalized or raw URLs to remove before same-batch dedup'
      }
    },
    required: ['items']
  };

  async handler(
    args: {
      items?: unknown;
      urlField?: string;
      titleField?: string;
      orderField?: string;
      titleThreshold?: number;
      historicalUrls?: string[];
    },
    _toolCtx?: ToolExecutionContext
  ) {
    const urlField = args.urlField || 'url';
    const titleField = args.titleField || 'title';
    const orderField = args.orderField || 'selectedOrder';
    const raw = parseItemsInput(args.items).map((item) => ({ ...item }));

    for (const item of raw) {
      copyField(item, urlField, 'url');
      copyField(item, titleField, 'title');
      copyField(item, orderField, 'selectedOrder');
    }

    const sorted = raw.sort(
      (a, b) => Number(a.selectedOrder ?? 9999) - Number(b.selectedOrder ?? 9999)
    );
    sorted.forEach((item, idx) => {
      if (item.index == null) item.index = idx + 1;
    });

    const historicalSet = new Set(
      (args.historicalUrls || [])
        .map((url) => normalizeUrlForDedup(String(url || '')))
        .filter(Boolean)
    );
    const afterHistory =
      historicalSet.size > 0
        ? sorted.filter((item) => {
            const norm = normalizeUrlForDedup(String(item.url ?? ''));
            return !norm || !historicalSet.has(norm);
          })
        : sorted;

    let threshold = args.titleThreshold;
    let sourceTierOverrides: Record<string, SourceTierSetting> | undefined;
    try {
      const ctx = requireToolContext(_toolCtx, this.id).services;
      const ec = ctx.settings.EDITORIAL_CONFIG;
      threshold = threshold ?? ec?.titleDedupThreshold ?? 0.92;
      sourceTierOverrides = ec?.sourceTierOverrides;
    } catch {
      threshold = threshold ?? 0.92;
    }

    const { items, removed } = deduplicatePipelineItems(
      afterHistory,
      threshold,
      sourceTierOverrides
    );
    const historicalRemoved = sorted.length - afterHistory.length;
    const payload = {
      count: items.length,
      items,
      dedup_log: {
        removed,
        removed_count: removed.length,
        historical_url_removed: historicalRemoved,
        cross_day_url_removed: historicalRemoved
      }
    };

    return {
      success: true,
      content: JSON.stringify(payload),
      ...payload,
      message: `Deduplicated ${sorted.length} -> ${items.length} items`
    };
  }
}
