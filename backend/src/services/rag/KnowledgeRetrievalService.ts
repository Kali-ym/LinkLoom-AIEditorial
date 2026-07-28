import type { SystemSettings } from '../../types/config.js';
import type {
  RagEvidence,
  RagExplicitRetrievalMode,
  RagRetrievalStage,
  RagRetrievalTrace,
  RagRetrievalUnit,
  RagSourceFilter
} from '../../types/rag.js';
import type { LocalStore } from '../LocalStore.js';
import { RagRetrievalPipeline } from './RagRetrievalPipeline.js';
import {
  createKnowledgeScopeMetadata,
  explicitKnowledgeFilter,
  mergeRagSourceFilters,
  unitMatchesKnowledgeFilter
} from './RagScope.js';
import { createRagTrace } from './RagTrace.js';
import { KnowledgeRetrievalSource } from './sources/KnowledgeRetrievalSource.js';

export interface KnowledgeRetrievalResult {
  rows: any[];
  units: RagRetrievalUnit[];
  evidence: RagEvidence[];
  trace: RagRetrievalTrace;
  retrievalMode: RagExplicitRetrievalMode;
  fallbackReason?: string;
  stages: RagRetrievalStage[];
  durationMs: number;
}

export class KnowledgeRetrievalService {
  constructor(
    private readonly store: LocalStore,
    private readonly getSettings: () => SystemSettings | null | undefined
  ) {}

  async search(
    query: string,
    options: {
      categoryIds?: string[];
      documentIds?: string[];
      sourceFilter?: RagSourceFilter;
      indexVersion?: string;
      limit?: number;
      traceId?: string;
      queries?: string[];
    } = {}
  ): Promise<KnowledgeRetrievalResult> {
    const source = new KnowledgeRetrievalSource(this.store);
    const pipeline = new RagRetrievalPipeline(
      source,
      this.getSettings,
      () => this.store.getKBVectorCapability(),
      async () => this.store.getRagEmbeddingCoverageStats()
    );
    const activeVersion = options.indexVersion
      ? null
      : typeof (this.store as any).getActiveRagIndexVersion === 'function'
        ? await this.store.getActiveRagIndexVersion('knowledge', 'knowledge')
        : null;
    const indexVersion = options.indexVersion || activeVersion?.version;
    const explicitFilter = explicitKnowledgeFilter({
      categoryIds: options.categoryIds,
      documentIds: options.documentIds
    });
    const filter = mergeRagSourceFilters(options.sourceFilter, explicitFilter) || explicitFilter;
    filter.metadata = {
      ...(filter.metadata || {}),
      ...(indexVersion ? { indexVersion } : {})
    };
    const result = await pipeline.search(query, {
      filters: [filter],
      limit: options.limit || 5,
      queries: options.queries
    });
    const scopedUnits = result.units.filter((unit) => unitMatchesKnowledgeFilter(unit, filter));
    const scopeFilteredCount = result.units.length - scopedUnits.length;
    const scopedEvidence = scopeFilteredCount > 0
      ? scopedUnits.map((unit, index) => source.toEvidence(unit, index))
      : result.evidence;
    const scopeStage: RagRetrievalStage = {
      name: 'scope_filter',
      status: 'success',
      resultCount: scopedUnits.length,
      metadata: {
        beforeCount: result.units.length,
        afterCount: scopedUnits.length,
        filteredCount: scopeFilteredCount,
        scope: createKnowledgeScopeMetadata(filter),
        sourceFilter: filter
      }
    };
    const stages = [...result.stages, scopeStage];
    const rows = scopedUnits.map((unit) => source.toLegacyRow(unit));
    const trace = createRagTrace({
      originalQuery: query,
      rewrittenQueries: result.rewrittenQueries,
      filters: [filter],
      units: scopedUnits,
      evidence: scopedEvidence,
      retrievalStages: stages,
      retrievalMode: result.retrievalMode,
      fallbackReason: result.fallbackReason,
      latencyMs: result.durationMs,
      metadata: {
        externalTraceId: options.traceId,
        retrievalMode: result.retrievalMode,
        fallbackReason: result.fallbackReason,
        indexVersion,
        activeIndexVersion: activeVersion?.version,
        scope: createKnowledgeScopeMetadata(filter),
        sourceFilter: filter,
        scopeFilteredCount,
        retrievalStages: stages
      }
    });

    return {
      rows,
      units: scopedUnits,
      evidence: scopedEvidence,
      trace,
      retrievalMode: result.retrievalMode,
      fallbackReason: result.fallbackReason,
      stages,
      durationMs: result.durationMs
    };
  }
}
