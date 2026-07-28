import type { SystemSettings } from '../../types/config.js';
import type {
  RagEvidence,
  RagExplicitRetrievalMode,
  RagRetrievalStage,
  RagRetrievalUnit,
  RagSourceFilter
} from '../../types/rag.js';
import { LogService } from '../LogService.js';
import {
  isHybridSearchEnabled,
  resolveEmbeddingService,
  resolveRagConfig,
  resolveRerankService
} from './RagSettings.js';
import { createEmbeddingClient, createRerankClient, cosineSimilarity } from './SmallModelClient.js';
import { KnowledgeRetrievalSource } from './sources/KnowledgeRetrievalSource.js';

export interface RagRetrievalPipelineResult {
  units: RagRetrievalUnit[];
  evidence: RagEvidence[];
  retrievalMode: RagExplicitRetrievalMode;
  fallbackReason?: string;
  stages: RagRetrievalStage[];
  durationMs: number;
  rewrittenQueries: string[];
}

export class RagRetrievalPipeline {
  constructor(
    private readonly knowledgeSource: KnowledgeRetrievalSource,
    private readonly getSettings: () => SystemSettings | null | undefined,
    private readonly vectorCapability: () => Promise<{ available: boolean; dimensions?: number; reason?: string }>,
    private readonly coverageStats: () => Promise<{ indexCoveragePercent: number; indexedChunkCount: number }>
  ) {}

  async search(
    query: string,
    options: { filters?: RagSourceFilter[]; limit?: number; queries?: string[] } = {}
  ): Promise<RagRetrievalPipelineResult> {
    const started = Date.now();
    const settings = this.getSettings();
    const rag = resolveRagConfig(settings);
    const limit = Math.max(1, options.limit || 5);
    const retrievalTopK = Math.max(limit, rag.retrievalTopK || 20);
    const filter = this.resolveKnowledgeFilter(options.filters);
    const queries = normalizeRetrievalQueries(query, options.queries);
    const stages: RagRetrievalStage[] = [];

    const ftsStarted = Date.now();
    const ftsBundles = await Promise.all(queries.map(async (item, index) => ({
      query: item,
      queryIndex: index,
      units: await this.knowledgeSource.searchFts(item, {
        filter,
        limit: retrievalTopK
      })
    })));
    const ftsUnits = ftsBundles.length === 1
      ? ftsBundles[0].units.slice(0, retrievalTopK)
      : mergeQueryRankings(
        ftsBundles.map((bundle) => ({
          query: bundle.query,
          queryIndex: bundle.queryIndex,
          mode: 'fts' as const,
          units: bundle.units,
          weight: 1
        }))
      ).slice(0, retrievalTopK);
    stages.push({
      name: 'fts',
      status: 'success',
      durationMs: Date.now() - ftsStarted,
      resultCount: ftsUnits.length,
      metadata: {
        queryCount: queries.length,
        perQuery: ftsBundles.map((bundle) => ({
          query: bundle.query,
          queryIndex: bundle.queryIndex,
          resultCount: bundle.units.length
        }))
      }
    });

    if (!isHybridSearchEnabled(settings)) {
      stages.push({ name: 'vector', status: 'skipped', reason: 'hybrid_disabled' });
      const units = this.applyFinalMmr(ftsUnits, limit, rag.mmrEnabled, rag.mmrLambda, undefined, stages);
      return this.result(units, 'fts', undefined, stages, started, queries);
    }

    const embedSvc = resolveEmbeddingService(settings);
    if (!embedSvc) {
      stages.push({ name: 'vector', status: 'skipped', reason: 'embedding_service_unavailable' });
      const units = this.applyFinalMmr(ftsUnits, limit, rag.mmrEnabled, rag.mmrLambda, undefined, stages);
      return this.result(units, 'fts', 'embedding_service_unavailable', stages, started, queries);
    }

    const coverage = await this.coverageStats();
    const coverageThreshold = normalizeCoverageThreshold(rag.minVectorCoverageForHybrid);
    if (coverage.indexCoveragePercent < coverageThreshold) {
      stages.push({
        name: 'coverage',
        status: 'skipped',
        reason: 'vector_coverage_below_threshold',
        resultCount: coverage.indexedChunkCount
      });
      const units = this.applyFinalMmr(ftsUnits, limit, rag.mmrEnabled, rag.mmrLambda, undefined, stages);
      return this.result(units, 'fts', 'vector_coverage_below_threshold', stages, started, queries);
    }

    try {
      const embedStarted = Date.now();
      const client = createEmbeddingClient(embedSvc);
      const queryVectors = await client.embed(queries);
      const actualDimensions = queryVectors.find((vector) => vector?.length)?.length || 0;
      stages.push({
        name: 'query_embedding',
        status: actualDimensions > 0 ? 'success' : 'failed',
        durationMs: Date.now() - embedStarted,
        resultCount: actualDimensions,
        metadata: {
          queryCount: queries.length,
          embeddedQueryCount: queryVectors.filter((vector) => vector?.length).length
        }
      });
      if (!actualDimensions) {
        const units = this.applyFinalMmr(ftsUnits, limit, rag.mmrEnabled, rag.mmrLambda, undefined, stages);
        return this.result(units, 'fts', 'empty_query_embedding', stages, started, queries);
      }

      const pgvector = await this.vectorCapability();
      const configuredDimensions = embedSvc.dimensions || client.dimensions;
      if (configuredDimensions && configuredDimensions !== actualDimensions) {
        stages.push({ name: 'dimension_check', status: 'failed', reason: 'dimension_mismatch' });
        const units = this.applyFinalMmr(ftsUnits, limit, rag.mmrEnabled, rag.mmrLambda, undefined, stages);
        return this.result(units, 'fts', 'dimension_mismatch', stages, started, queries);
      }

      const vectorStarted = Date.now();
      let vectorBundles: Array<{ query: string; queryIndex: number; units: RagRetrievalUnit[] }> = [];
      let fallbackReason: string | undefined;
      if (pgvector.available && (!pgvector.dimensions || pgvector.dimensions === actualDimensions)) {
        vectorBundles = await Promise.all(queryVectors.map(async (queryVector, index) => ({
          query: queries[index],
          queryIndex: index,
          units: queryVector?.length
            ? await this.knowledgeSource.searchPgVector(queryVector, {
              filter,
              limit: retrievalTopK
            })
            : []
        })));
        stages.push({
          name: 'pgvector',
          status: 'success',
          durationMs: Date.now() - vectorStarted,
          resultCount: vectorBundles.reduce((sum, bundle) => sum + bundle.units.length, 0),
          metadata: {
            queryCount: queries.length,
            perQuery: vectorBundles.map((bundle) => ({
              query: bundle.query,
              queryIndex: bundle.queryIndex,
              resultCount: bundle.units.length
            }))
          }
        });
      } else if (rag.jsonbVectorFallbackEnabled) {
        vectorBundles = await Promise.all(queryVectors.map(async (queryVector, index) => ({
          query: queries[index],
          queryIndex: index,
          units: queryVector?.length
            ? await this.knowledgeSource.searchJsonbVector(queryVector, {
              filter,
              limit: retrievalTopK
            })
            : []
        })));
        fallbackReason = pgvector.available
          ? 'pgvector_dimension_mismatch_jsonb_fallback'
          : 'pgvector_unavailable_jsonb_fallback';
        stages.push({
          name: 'jsonb_vector',
          status: 'success',
          durationMs: Date.now() - vectorStarted,
          resultCount: vectorBundles.reduce((sum, bundle) => sum + bundle.units.length, 0),
          reason: fallbackReason,
          metadata: {
            queryCount: queries.length,
            perQuery: vectorBundles.map((bundle) => ({
              query: bundle.query,
              queryIndex: bundle.queryIndex,
              resultCount: bundle.units.length
            }))
          }
        });
      } else {
        const reason = pgvector.reason || 'pgvector_unavailable';
        stages.push({
          name: 'vector',
          status: 'skipped',
          durationMs: Date.now() - vectorStarted,
          reason
        });
        const units = this.applyFinalMmr(ftsUnits, limit, rag.mmrEnabled, rag.mmrLambda, undefined, stages);
        return this.result(units, 'fts', reason, stages, started, queries);
      }

      const merged = mergeQueryRankings([
        ...ftsBundles.map((bundle) => ({
          query: bundle.query,
          queryIndex: bundle.queryIndex,
          mode: 'fts' as const,
          units: bundle.units,
          weight: Math.abs(rag.ftsWeight || 0.5) / Math.max(1, ftsBundles.length)
        })),
        ...vectorBundles.map((bundle) => ({
          query: bundle.query,
          queryIndex: bundle.queryIndex,
          mode: 'vector' as const,
          units: bundle.units,
          weight: Math.abs(rag.vectorWeight || 0.5) / Math.max(1, vectorBundles.length)
        }))
      ]).slice(0, retrievalTopK);
      let finalUnits = merged;
      let retrievalMode: RagExplicitRetrievalMode = 'hybrid';

      const rerankSvc = resolveRerankService(settings);
      if (rag.rerankEnabled && rerankSvc && merged.length > 0) {
        const rerankStarted = Date.now();
        try {
          const rerankClient = createRerankClient(rerankSvc);
          const docs = merged.map((unit) => unit.text);
          const ranked = await rerankClient.rerank(query, docs);
          finalUnits = ranked
            .sort((a, b) => b.score - a.score)
            .reduce<RagRetrievalUnit[]>((acc, hit) => {
              const unit = merged[hit.index];
              if (unit) acc.push({ ...unit, score: hit.score });
              return acc;
            }, [])
            .slice(0, Math.max(limit, rag.rerankTopK || limit));
          retrievalMode = 'hybrid+rerank';
          stages.push({
            name: 'rerank',
            status: 'success',
            durationMs: Date.now() - rerankStarted,
            resultCount: finalUnits.length
          });
        } catch (err) {
          LogService.warn(`RAG rerank fallback to hybrid: ${err}`);
          stages.push({
            name: 'rerank',
            status: 'failed',
            durationMs: Date.now() - rerankStarted,
            error: String(err)
          });
          finalUnits = merged.slice(0, limit);
          fallbackReason = fallbackReason || 'rerank_failed';
        }
      }

      finalUnits = this.applyFinalMmr(finalUnits, limit, rag.mmrEnabled, rag.mmrLambda, queryVectors[0], stages);

      return this.result(finalUnits, retrievalMode, fallbackReason, stages, started, queries);
    } catch (err) {
      LogService.warn(`RAG retrieval fallback to FTS: ${err}`);
      stages.push({ name: 'vector', status: 'failed', error: String(err) });
      const units = this.applyFinalMmr(ftsUnits, limit, rag.mmrEnabled, rag.mmrLambda, undefined, stages);
      return this.result(units, 'fts', 'embedding_error', stages, started, queries);
    }
  }

  private resolveKnowledgeFilter(filters?: RagSourceFilter[]): RagSourceFilter | undefined {
    const knowledge = (filters || []).filter((filter) => !filter.sourceType || filter.sourceType === 'knowledge');
    if (knowledge.length === 0) return undefined;
    return {
      sourceType: 'knowledge',
      sourceIds: mergeStringArrays(knowledge.flatMap((filter) => filter.sourceIds || [])),
      parentIds: mergeStringArrays(knowledge.flatMap((filter) => filter.parentIds || [])),
      unitIds: mergeStringArrays(knowledge.flatMap((filter) => filter.unitIds || [])),
      metadata: mergeMetadata(knowledge.map((filter) => filter.metadata || {}))
    };
  }

  private applyFinalMmr(
    units: RagRetrievalUnit[],
    limit: number,
    enabled: boolean | undefined,
    lambda: number | undefined,
    queryVector: number[] | undefined,
    stages: RagRetrievalStage[]
  ): RagRetrievalUnit[] {
    const mmrStarted = Date.now();
    if (enabled === false) {
      const selected = units.slice(0, limit);
      stages.push({
        name: 'mmr',
        status: 'skipped',
        durationMs: Date.now() - mmrStarted,
        resultCount: selected.length,
        reason: 'mmr_disabled'
      });
      return selected;
    }
    const mmr = applyMmr(units, limit, { lambda, queryVector });
    stages.push({
      name: 'mmr',
      status: 'success',
      durationMs: Date.now() - mmrStarted,
      resultCount: mmr.units.length,
      metadata: mmr.metadata
    });
    return mmr.units;
  }

  private result(
    units: RagRetrievalUnit[],
    retrievalMode: RagExplicitRetrievalMode,
    fallbackReason: string | undefined,
    stages: RagRetrievalStage[],
    started: number,
    rewrittenQueries: string[]
  ): RagRetrievalPipelineResult {
    const evidence = units.map((unit, index) => this.knowledgeSource.toEvidence(unit, index));
    return {
      units,
      evidence,
      retrievalMode,
      fallbackReason,
      stages,
      durationMs: Date.now() - started,
      rewrittenQueries
    };
  }
}

function normalizeCoverageThreshold(value: number | undefined): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : 0.8;
  return raw <= 1 ? raw * 100 : raw;
}

function normalizeRetrievalQueries(query: string, queries?: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [query, ...(queries || [])]) {
    const text = String(item || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.length ? out : [query];
}

function mergeQueryRankings(
  rankings: Array<{
    query: string;
    queryIndex: number;
    mode: 'fts' | 'vector';
    units: RagRetrievalUnit[];
    weight: number;
  }>
): RagRetrievalUnit[] {
  const scores = new Map<string, {
    unit: RagRetrievalUnit;
    score: number;
    sources: Array<{ query: string; queryIndex: number; mode: 'fts' | 'vector'; rank: number }>;
  }>();
  for (const ranking of rankings) {
    const weight = Math.max(0.0001, Math.abs(ranking.weight || 1));
    ranking.units.forEach((unit, rank) => {
      const inc = weight / (60 + rank + 1);
      const existing = scores.get(unit.unitId);
      if (existing) {
        existing.score += inc;
        existing.sources.push({
          query: ranking.query,
          queryIndex: ranking.queryIndex,
          mode: ranking.mode,
          rank: rank + 1
        });
      } else {
        scores.set(unit.unitId, {
          unit,
          score: inc,
          sources: [{
            query: ranking.query,
            queryIndex: ranking.queryIndex,
            mode: ranking.mode,
            rank: rank + 1
          }]
        });
      }
    });
  }
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({
      ...entry.unit,
      score: entry.score,
      metadata: {
        ...(entry.unit.metadata || {}),
        retrievalSources: entry.sources
      }
    }));
}

type MmrSimilarityMode = 'embedding' | 'text';

interface MmrSelection {
  unitId: string;
  score: number;
  relevance: number;
  diversityPenalty: number;
  similarityMode: MmrSimilarityMode;
  mostSimilarSelectedUnitId?: string;
}

interface MmrDropped {
  unitId: string;
  reason: 'duplicate_text' | 'duplicate_unit' | 'limit_reached';
  mostSimilarSelectedUnitId?: string;
  similarity?: number;
}

function applyMmr(
  units: RagRetrievalUnit[],
  limit: number,
  options: { lambda?: number; queryVector?: number[] } = {}
): { units: RagRetrievalUnit[]; metadata: Record<string, unknown> } {
  const target = Math.max(1, limit);
  const lambda = normalizeMmrLambda(options.lambda);
  const vectors = units.map((unit) => extractEmbedding(unit));
  const canUseEmbedding = Boolean(options.queryVector?.length) && vectors.some((vector) => vector.length === options.queryVector!.length);
  const mode: MmrSimilarityMode = canUseEmbedding ? 'embedding' : 'text';
  const relevanceScores = normalizeRelevanceScores(units, options.queryVector, vectors, mode);
  const selectedIndexes: number[] = [];
  const candidateIndexes = units.map((_, index) => index);
  const dropped: MmrDropped[] = [];
  const selections: MmrSelection[] = [];
  const seenText = new Map<string, number>();

  for (const index of [...candidateIndexes]) {
    const fingerprint = textFingerprint(units[index].text);
    if (!fingerprint) continue;
    const duplicateOf = seenText.get(fingerprint);
    if (duplicateOf !== undefined) {
      removeCandidate(candidateIndexes, index);
      dropped.push({
        unitId: units[index].unitId,
        reason: 'duplicate_text',
        mostSimilarSelectedUnitId: units[duplicateOf].unitId,
        similarity: 1
      });
    } else {
      seenText.set(fingerprint, index);
    }
  }

  while (selectedIndexes.length < target && candidateIndexes.length > 0) {
    let bestIndex = candidateIndexes[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestPenalty = 0;
    let bestSimilarIndex: number | undefined;

    for (const index of candidateIndexes) {
      const similarity = maxSelectedSimilarity(index, selectedIndexes, units, vectors, mode);
      const score = lambda * relevanceScores[index] - (1 - lambda) * similarity.value;
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
        bestPenalty = similarity.value;
        bestSimilarIndex = similarity.index;
      }
    }

    selectedIndexes.push(bestIndex);
    removeCandidate(candidateIndexes, bestIndex);
    selections.push({
      unitId: units[bestIndex].unitId,
      score: bestScore,
      relevance: relevanceScores[bestIndex],
      diversityPenalty: bestPenalty,
      similarityMode: mode,
      mostSimilarSelectedUnitId: bestSimilarIndex !== undefined ? units[bestSimilarIndex].unitId : undefined
    });
  }

  for (const index of candidateIndexes) {
    dropped.push({
      unitId: units[index].unitId,
      reason: 'limit_reached',
      ...nearestSelected(index, selectedIndexes, units, vectors, mode)
    });
  }

  const selected = selectedIndexes.map((index) => units[index]);

  return {
    units: selected,
    metadata: {
      inputCount: units.length,
      selectedUnitIds: selected.map((unit) => unit.unitId),
      dropped,
      selections,
      lambda,
      similarityMode: mode
    }
  };
}

function normalizeMmrLambda(value: unknown): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : 0.7;
  return Math.max(0, Math.min(1, raw));
}

function normalizeRelevanceScores(
  units: RagRetrievalUnit[],
  queryVector: number[] | undefined,
  vectors: number[][],
  mode: MmrSimilarityMode
): number[] {
  if (mode === 'embedding' && queryVector?.length) {
    return vectors.map((vector, index) => {
      const value = vector.length === queryVector.length
        ? cosineSimilarity(queryVector, vector)
        : numberOrZero(units[index].score);
      return Math.max(0, value);
    });
  }
  const scores = units.map((unit) => numberOrZero(unit.score));
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 1);
  const spread = max - min || 1;
  return scores.map((score, index) => {
    const normalizedScore = (score - min) / spread;
    const rankBoost = 1 - index / Math.max(1, units.length);
    return Math.max(normalizedScore, rankBoost * 0.01);
  });
}

function maxSelectedSimilarity(
  index: number,
  selectedIndexes: number[],
  units: RagRetrievalUnit[],
  vectors: number[][],
  mode: MmrSimilarityMode
): { value: number; index?: number } {
  let value = 0;
  let selectedIndex: number | undefined;
  for (const current of selectedIndexes) {
    const similarity = unitSimilarity(index, current, units, vectors, mode);
    if (similarity > value) {
      value = similarity;
      selectedIndex = current;
    }
  }
  return { value, index: selectedIndex };
}

function nearestSelected(
  index: number,
  selectedIndexes: number[],
  units: RagRetrievalUnit[],
  vectors: number[][],
  mode: MmrSimilarityMode
): { mostSimilarSelectedUnitId?: string; similarity?: number } {
  const nearest = maxSelectedSimilarity(index, selectedIndexes, units, vectors, mode);
  return {
    mostSimilarSelectedUnitId: nearest.index !== undefined ? units[nearest.index].unitId : undefined,
    similarity: nearest.value
  };
}

function unitSimilarity(
  left: number,
  right: number,
  units: RagRetrievalUnit[],
  vectors: number[][],
  mode: MmrSimilarityMode
): number {
  if (mode === 'embedding' && vectors[left].length && vectors[left].length === vectors[right].length) {
    return Math.max(0, cosineSimilarity(vectors[left], vectors[right]));
  }
  return textSimilarity(units[left].text, units[right].text);
}

function extractEmbedding(unit: RagRetrievalUnit): number[] {
  const candidates = [
    unit.metadata?.embedding,
    unit.metadata?.knowledge && typeof unit.metadata.knowledge === 'object'
      ? (unit.metadata.knowledge as Record<string, unknown>).embedding
      : undefined,
    unit.metadata?.legacyRow && typeof unit.metadata.legacyRow === 'object'
      ? (unit.metadata.legacyRow as Record<string, unknown>).embedding
      : undefined,
    unit.metadata?.legacyRow && typeof unit.metadata.legacyRow === 'object'
      ? (unit.metadata.legacyRow as Record<string, unknown>).embeddingJson
      : undefined,
    unit.metadata?.legacyRow && typeof unit.metadata.legacyRow === 'object'
      ? (unit.metadata.legacyRow as Record<string, unknown>).embedding_json
      : undefined
  ];
  for (const candidate of candidates) {
    const parsed = parseEmbedding(candidate);
    if (parsed.length) return parsed;
  }
  return [];
}

function parseEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return parseEmbedding(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function textSimilarity(left: string, right: string): number {
  const a = tokenizeText(left);
  const b = tokenizeText(right);
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap / Math.sqrt(a.size * b.size);
}

function tokenizeText(text: string): Set<string> {
  const normalized = String(text || '').toLowerCase();
  const latin = normalized.match(/[a-z0-9_-]{2,}/g) || [];
  const cjk = normalized.match(/[\p{Script=Han}]{1,2}/gu) || [];
  return new Set([...latin, ...cjk]);
}

function textFingerprint(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220).toLowerCase();
}

function removeCandidate(candidates: number[], value: number): void {
  const index = candidates.indexOf(value);
  if (index >= 0) candidates.splice(index, 1);
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mergeStringArrays(values: string[]): string[] | undefined {
  const merged = [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
  return merged.length ? merged : undefined;
}

function mergeMetadata(items: Record<string, unknown>[]): Record<string, unknown> | undefined {
  const merged: Record<string, unknown> = {};
  for (const item of items) {
    for (const [key, value] of Object.entries(item)) {
      if (Array.isArray(value)) {
        const existing = Array.isArray(merged[key]) ? merged[key] as unknown[] : [];
        merged[key] = [...new Set([...existing, ...value])];
      } else if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}