import type { SystemSettings } from '../../types/config.js';
import type { RagPlannerStage } from '../../types/rag.js';
import { getISODate } from '../../utils/helpers.js';
import { AgentService } from '../agents/AgentService.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { PromptService } from '../PromptService.js';
import { resolveRagConfig, resolveRagPlannerAgentId } from './RagSettings.js';

export interface RagQueryPlan {
  originalQuery: string;
  retrievalQuery: string;
  categoryIds?: string[];
  documentIds?: string[];
  stages: RagPlannerStage[];
  fallbackReason?: string;
}

export interface RagQueryExpansionResult {
  originalQuery: string;
  queries: string[];
  hydeQuery?: string;
  multiQueryVariants: string[];
  stages: RagPlannerStage[];
  fallbackReason?: string;
}

const MAX_EXPANDED_QUERY_COUNT = 5;

export class RagQueryPlanner {
  constructor(
    private readonly store: LocalStore,
    private readonly agentService: AgentService | null,
    private readonly getSettings: () => SystemSettings | null | undefined
  ) {}

  async plan(query: string, options: { categoryIds?: string[]; documentIds?: string[] } = {}): Promise<RagQueryPlan> {
    const settings = this.getSettings();
    const rag = resolveRagConfig(settings);
    const base: RagQueryPlan = {
      originalQuery: query,
      retrievalQuery: query,
      categoryIds: options.categoryIds,
      documentIds: options.documentIds,
      stages: []
    };

    if (!rag.queryRewriteEnabled) {
      base.stages.push({ name: 'query_rewrite', status: 'skipped', reason: 'query_rewrite_disabled' });
      return base;
    }
    if (!this.agentService) {
      base.stages.push({ name: 'query_rewrite', status: 'skipped', reason: 'agent_service_unavailable' });
      base.fallbackReason = 'planner_agent_unavailable';
      return base;
    }
    const plannerAgentId = resolveRagPlannerAgentId(rag);
    if (!plannerAgentId) {
      base.stages.push({ name: 'query_rewrite', status: 'skipped', reason: 'planner_agent_unconfigured' });
      base.fallbackReason = 'planner_agent_unconfigured';
      return base;
    }
    if (options.documentIds?.length) {
      base.stages.push({ name: 'scope', status: 'skipped', reason: 'document_scope_provided' });
      return base;
    }

    try {
      const selectedCategoryIds = options.categoryIds?.length
        ? options.categoryIds
        : await this.chooseCategories(query, plannerAgentId, rag.plannerMaxCategories, base.stages);
      base.categoryIds = selectedCategoryIds?.length ? selectedCategoryIds : options.categoryIds;

      if (base.categoryIds?.length) {
        const docIds = await this.chooseDocuments(
          query,
          plannerAgentId,
          base.categoryIds,
          rag.plannerMaxDocuments,
          base.stages
        );
        if (docIds.length > 0) base.documentIds = docIds;
      }

      return base;
    } catch (err) {
      LogService.warn(`RAG query planner fallback: ${err}`);
      base.stages.push({ name: 'planner', status: 'failed', error: String(err) });
      base.fallbackReason = 'planner_failed';
      return base;
    }
  }

  async expand(query: string): Promise<RagQueryExpansionResult> {
    const settings = this.getSettings();
    const rag = resolveRagConfig(settings);
    const base: RagQueryExpansionResult = {
      originalQuery: query,
      queries: [query],
      multiQueryVariants: [],
      stages: []
    };

    if (!rag.queryRewriteEnabled) {
      base.stages.push({ name: 'query_expansion', status: 'skipped', reason: 'query_rewrite_disabled' });
      return base;
    }
    if (!this.agentService) {
      base.stages.push({ name: 'query_expansion', status: 'skipped', reason: 'agent_service_unavailable' });
      base.fallbackReason = 'expansion_agent_unavailable';
      return base;
    }
    const plannerAgentId = resolveRagPlannerAgentId(rag);
    if (!plannerAgentId) {
      base.stages.push({ name: 'query_expansion', status: 'skipped', reason: 'planner_agent_unconfigured' });
      base.fallbackReason = 'planner_agent_unconfigured';
      return base;
    }

    const started = Date.now();
    try {
      const maxQueryCount = normalizeExpansionQueryCount(rag.queryExpansionMaxQueries);
      const prompt = PromptService.getInstance().getPrompt('knowledge_query_expansion', {
        today: getISODate(),
        query
      });
      const result = await this.agentService.runAgent(plannerAgentId, prompt, undefined, {
        silent: true,
        noTools: true
      });
      const parsed = parseExpansionOutput(result.content);
      const hydeQuery = parsed.hydeQuery;
      const multiQueryVariants = parsed.multiQueryVariants.slice(0, Math.max(0, maxQueryCount - 1));
      const queries = uniqueQueries([query, hydeQuery, ...multiQueryVariants]).slice(0, maxQueryCount);
      const querySet = new Set(queries.map((item) => item.toLowerCase()));
      const originalKey = normalizeQueryText(query)?.toLowerCase();
      base.hydeQuery = hydeQuery && querySet.has(hydeQuery.toLowerCase()) ? hydeQuery : undefined;
      base.multiQueryVariants = multiQueryVariants.filter((item) => {
        const key = item.toLowerCase();
        return key !== originalKey && querySet.has(key);
      });
      base.queries = queries.length ? queries : [query];
      base.stages.push({
        name: 'query_expansion',
        status: 'success',
        durationMs: Date.now() - started,
        outputCount: Math.max(0, base.queries.length - 1),
        metadata: {
          queryCount: base.queries.length,
          hasHydeQuery: Boolean(base.hydeQuery),
          multiQueryCount: base.multiQueryVariants.length
        }
      });
      return base;
    } catch (err) {
      LogService.warn(`RAG query expansion fallback: ${err}`);
      base.stages.push({
        name: 'query_expansion',
        status: 'failed',
        durationMs: Date.now() - started,
        error: String(err)
      });
      base.fallbackReason = 'query_expansion_failed';
      return base;
    }
  }

  private async chooseCategories(
    query: string,
    plannerAgentId: string,
    maxCategories: number,
    stages: RagPlannerStage[]
  ): Promise<string[] | undefined> {
    const started = Date.now();
    const categories = await this.store.listKBCategories();
    if (categories.length === 0) {
      stages.push({ name: 'category_choice', status: 'skipped', reason: 'no_categories' });
      return undefined;
    }

    const categoriesStr = categories
      .map((cat) => `- ${cat.id}: ${cat.name}${cat.description ? ` — ${cat.description}` : ''}`)
      .join('\n');
    const prompt = PromptService.getInstance().getPrompt('knowledge_root_nav', {
      today: getISODate(),
      categoriesStr,
      query
    });
    const result = await this.agentService!.runAgent(plannerAgentId, prompt, undefined, {
      silent: true,
      noTools: true
    });
    const ids = sanitizeIds(extractJsonArray(result.content), new Set(categories.map((cat) => cat.id)))
      .slice(0, Math.max(1, maxCategories || 3));
    stages.push({
      name: 'category_choice',
      status: 'success',
      durationMs: Date.now() - started,
      outputCount: ids.length
    });
    return ids.length ? ids : undefined;
  }

  private async chooseDocuments(
    query: string,
    plannerAgentId: string,
    categoryIds: string[],
    maxDocuments: number,
    stages: RagPlannerStage[]
  ): Promise<string[]> {
    const started = Date.now();
    const chosen = new Set<string>();
    for (const categoryId of categoryIds) {
      const category = await this.store.getKBCategory(categoryId);
      if (!category) continue;
      const docs = await this.store.listKBDocuments(categoryId);
      if (docs.length === 0) continue;
      const docsStr = docs
        .map((doc) => `- ${doc.id}: ${doc.name}${doc.summary ? ` — ${doc.summary}` : ''}`)
        .join('\n');
      const prompt = PromptService.getInstance().getPrompt('knowledge_doc_choice', {
        today: getISODate(),
        categoryName: category.name,
        docsStr,
        query
      });
      const result = await this.agentService!.runAgent(plannerAgentId, prompt, undefined, {
        silent: true,
        noTools: true
      });
      const allowed = new Set(docs.map((doc) => doc.id));
      for (const id of sanitizeIds(extractJsonArray(result.content), allowed)) {
        chosen.add(id);
        if (chosen.size >= Math.max(1, maxDocuments || 8)) break;
      }
      if (chosen.size >= Math.max(1, maxDocuments || 8)) break;
    }
    stages.push({
      name: 'document_choice',
      status: 'success',
      durationMs: Date.now() - started,
      outputCount: chosen.size
    });
    return Array.from(chosen);
  }
}

function extractJsonArray(text: string): unknown[] {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const direct = tryParseArray(raw);
  if (direct) return direct;
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return tryParseArray(match[0]) || [];
}

function parseExpansionOutput(text: string): { hydeQuery?: string; multiQueryVariants: string[] } {
  const raw = String(text || '').trim();
  const parsed = tryParseObject(raw) || parseFirstJsonObject(raw);
  if (parsed) {
    const hydeQuery = normalizeQueryText(parsed.hydeQuery ?? parsed.hyde ?? parsed.hypotheticalAnswer);
    const rawVariants = Array.isArray(parsed.multiQueryVariants)
      ? parsed.multiQueryVariants
      : Array.isArray(parsed.queries)
        ? parsed.queries
        : Array.isArray(parsed.variants)
          ? parsed.variants
          : [];
    return {
      hydeQuery,
      multiQueryVariants: uniqueQueries(rawVariants.map((item) => normalizeQueryText(item)))
    };
  }
  return {
    hydeQuery: undefined,
    multiQueryVariants: uniqueQueries(extractJsonArray(raw).map((item) => normalizeQueryText(item)))
  };
}

function tryParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function parseFirstJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? tryParseObject(match[0]) : null;
}

function normalizeQueryText(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text || undefined;
}

function uniqueQueries(values: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const text = normalizeQueryText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function normalizeExpansionQueryCount(value: unknown): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : MAX_EXPANDED_QUERY_COUNT;
  return Math.min(8, Math.max(1, raw));
}

function tryParseArray(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeIds(values: unknown[], allowed: Set<string>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (id && allowed.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}