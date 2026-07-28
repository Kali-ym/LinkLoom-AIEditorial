import { typeid } from 'typeid-js';
import type {
  RagEvalComparison,
  RagEvalDataset,
  RagEvalRun,
  RagEvalScore,
  RagEvidence,
  RagIndexVersion,
  RagSourceFilter
} from '../../types/rag.js';
import type { LocalStore } from '../LocalStore.js';
import { explicitKnowledgeFilter } from './RagScope.js';
import { KnowledgeRetrievalService } from './KnowledgeRetrievalService.js';

const NUMERIC_SCORE_FIELDS = [
  'recallAtK',
  'precisionAtK',
  'mrr',
  'hitRate',
  'citationAccuracy',
  'refusalAccuracy'
] as const;

export class RagEvalService {
  constructor(private readonly store: LocalStore) {}

  async createDataset(input: {
    name: string;
    description?: string;
    cases?: Array<Partial<RagEvalDataset['cases'][number]>>;
    metadata?: Record<string, unknown>;
  }): Promise<RagEvalDataset> {
    const now = Date.now();
    const datasetId = typeid('rageval').toString();
    const dataset: RagEvalDataset = {
      id: datasetId,
      name: input.name,
      description: input.description,
      cases: (input.cases || []).map((item, index) => ({
        id: item.id || typeid('ragecase').toString(),
        datasetId,
        question: String(item.question || '').trim(),
        expectedAnswer: item.expectedAnswer,
        expectedEvidenceIds: item.expectedEvidenceIds,
        allowedSourceTypes: item.allowedSourceTypes || ['knowledge'],
        allowedSourceIds: item.allowedSourceIds,
        allowedParentIds: item.allowedParentIds,
        allowedUnitIds: item.allowedUnitIds,
        difficulty: item.difficulty,
        category: item.category,
        notes: item.notes,
        metadata: { index, ...(item.metadata || {}) }
      })).filter((item) => item.question),
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };
    await this.store.saveRagEvalDataset(dataset);
    return dataset;
  }

  async listDatasets(): Promise<RagEvalDataset[]> {
    return this.store.listRagEvalDatasets();
  }

  async runDataset(input: {
    datasetId: string;
    indexVersion?: string;
    getSettings: () => any;
    limit?: number;
  }): Promise<RagEvalRun> {
    const datasets = await this.store.listRagEvalDatasets();
    const dataset = datasets.find((item) => item.id === input.datasetId);
    if (!dataset) throw new Error(`RAG eval dataset ${input.datasetId} not found`);
    const service = new KnowledgeRetrievalService(this.store, input.getSettings);
    const scores: RagEvalScore[] = [];

    for (const testCase of dataset.cases) {
      const filter = createEvalCaseFilter(testCase);
      const result = await service.search(testCase.question, {
        sourceFilter: filter,
        documentIds: filter.parentIds,
        indexVersion: input.indexVersion,
        limit: input.limit || 5
      });
      scores.push(scoreEvalCase(testCase, result.evidence, {
        retrievalMode: result.retrievalMode,
        traceId: result.trace.traceId
      }));
    }

    const run: RagEvalRun = {
      id: typeid('ragevrun').toString(),
      datasetId: dataset.id,
      indexVersion: input.indexVersion,
      scores,
      summary: summarizeEvalScores(scores),
      createdAt: Date.now()
    };
    await this.store.saveRagEvalRun(run);
    return run;
  }

  async listRuns(datasetId?: string, options: { indexVersion?: string; limit?: number } = {}): Promise<RagEvalRun[]> {
    return this.store.listRagEvalRuns(datasetId, options);
  }

  async compareRuns(input: {
    datasetId?: string;
    baselineRunId?: string;
    candidateRunId?: string;
    baselineIndexVersion?: string;
    candidateIndexVersion?: string;
    threshold?: number;
    maxRegressionRate?: number;
  }): Promise<RagEvalComparison> {
    const candidateRun = await this.resolveRun({
      datasetId: input.datasetId,
      runId: input.candidateRunId,
      indexVersion: input.candidateIndexVersion,
      label: 'candidate'
    });
    const baselineRun = await this.resolveRun({
      datasetId: input.datasetId || candidateRun.datasetId,
      runId: input.baselineRunId,
      indexVersion: input.baselineIndexVersion,
      label: 'baseline'
    });
    return compareEvalRuns({
      datasetId: input.datasetId || candidateRun.datasetId || baselineRun.datasetId,
      baselineRun,
      candidateRun,
      threshold: input.threshold,
      maxRegressionRate: input.maxRegressionRate
    });
  }

  private async resolveRun(input: {
    datasetId?: string;
    runId?: string;
    indexVersion?: string;
    label: 'baseline' | 'candidate';
  }): Promise<RagEvalRun> {
    const runs = await this.store.listRagEvalRuns(input.datasetId, {
      indexVersion: input.indexVersion,
      limit: 200
    });
    const run = input.runId
      ? runs.find((item) => item.id === input.runId)
      : runs[0];
    if (!run) {
      const by = input.runId
        ? `run ${input.runId}`
        : input.indexVersion
          ? `indexVersion ${input.indexVersion}`
          : `dataset ${input.datasetId || '*'}`;
      throw new Error(`RAG eval ${input.label} ${by} not found`);
    }
    return run;
  }
}

export function summarizeEvalScores(scores: RagEvalScore[]): Record<string, unknown> {
  const passed = scores.filter((score) => score.passed).length;
  const summary: Record<string, unknown> = {
    total: scores.length,
    passed,
    passRate: scores.length > 0 ? passed / scores.length : 0
  };
  for (const field of NUMERIC_SCORE_FIELDS) {
    const value = averageDefined(scores.map((score) => score[field]));
    if (value !== undefined) summary[field] = value;
  }
  const answerContainsRate = averageDefined(
    scores
      .map((score) => score.answerContains)
      .filter((value): value is boolean => typeof value === 'boolean')
      .map((value) => value ? 1 : 0)
  );
  if (answerContainsRate !== undefined) summary.answerContainsRate = answerContainsRate;
  return summary;
}

export function compareEvalRuns(input: {
  datasetId: string;
  baselineRun: RagEvalRun;
  candidateRun: RagEvalRun;
  threshold?: number;
  maxRegressionRate?: number;
}): RagEvalComparison {
  const threshold = normalizeFraction(input.threshold, 0.8);
  const maxRegressionRate = normalizeFraction(input.maxRegressionRate, 0);
  const baseline = metricsFromRun(input.baselineRun);
  const candidate = metricsFromRun(input.candidateRun);
  const delta = numericDelta(candidate, baseline);
  const baselineScores = new Map(input.baselineRun.scores.map((score) => [score.caseId, score]));
  const candidateScores = new Map(input.candidateRun.scores.map((score) => [score.caseId, score]));
  const caseIds = [...new Set([...baselineScores.keys(), ...candidateScores.keys()])];
  const cases = caseIds.map((caseId) => {
    const base = baselineScores.get(caseId);
    const cand = candidateScores.get(caseId);
    const itemDelta = cand && base ? scoreDelta(cand, base) : undefined;
    return {
      caseId,
      status: compareCaseStatus(base, cand, itemDelta),
      baselinePassed: base?.passed,
      candidatePassed: cand?.passed,
      delta: itemDelta
    } satisfies RagEvalComparison['cases'][number];
  });
  const comparableCases = cases.filter((item) => item.status !== 'new_case' && item.status !== 'missing_candidate');
  const regressionCount = comparableCases.filter((item) => item.status === 'regressed').length;
  const regressionRate = comparableCases.length > 0 ? regressionCount / comparableCases.length : 0;
  const passRate = candidate.passRate || 0;
  const baselinePassRate = baseline.passRate || 0;
  const passRateDelta = passRate - baselinePassRate;
  const reason = passRate < threshold
    ? 'pass_rate_below_threshold'
    : regressionRate > maxRegressionRate
      ? 'regression_rate_exceeded'
      : undefined;

  return {
    datasetId: input.datasetId,
    baselineRun: input.baselineRun,
    candidateRun: input.candidateRun,
    metrics: { baseline, candidate, delta },
    cases,
    gate: {
      passed: !reason,
      threshold,
      passRate,
      baselinePassRate,
      passRateDelta,
      maxRegressionRate,
      regressionRate,
      reason
    }
  };
}

export function createCandidateIndexVersion(input: {
  sourceId?: string;
  chunkerVersion?: string;
  embeddingProviderId?: string;
  embeddingConfigHash?: string;
  metadata?: Record<string, unknown>;
}): RagIndexVersion {
  const now = Date.now();
  const id = typeid('ragidx').toString();
  const version = [
    'knowledge',
    input.sourceId || 'knowledge',
    input.chunkerVersion || 'chunker',
    input.embeddingConfigHash?.slice(0, 8) || 'embed',
    String(now),
    id.slice(-8)
  ].join(':');
  return {
    id,
    sourceType: 'knowledge',
    sourceId: input.sourceId || 'knowledge',
    version,
    status: 'candidate',
    chunkerVersion: input.chunkerVersion,
    embeddingProviderId: input.embeddingProviderId,
    embeddingConfigHash: input.embeddingConfigHash,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now
  };
}

function createEvalCaseFilter(testCase: RagEvalDataset['cases'][number]): RagSourceFilter {
  const filter = explicitKnowledgeFilter({
    documentIds: testCase.allowedParentIds
  });
  const unitIds = unique(testCase.allowedUnitIds);
  return {
    ...filter,
    sourceIds: unique(testCase.allowedSourceIds).length ? unique(testCase.allowedSourceIds) : filter.sourceIds,
    unitIds: unitIds.length ? unitIds : undefined,
    metadata: {
      ...(filter.metadata || {}),
      allowedSourceTypes: testCase.allowedSourceTypes || ['knowledge'],
      ...(unitIds.length ? { unitIds } : {})
    }
  };
}

function scoreEvalCase(
  testCase: RagEvalDataset['cases'][number],
  evidence: RagEvidence[],
  metadata: Record<string, unknown>
): RagEvalScore {
  const expectedEvidenceIds = unique(testCase.expectedEvidenceIds);
  const retrievedEvidenceIds = evidence.map((item) => item.evidenceId);
  const retrievedUnitIds = evidence.map((item) => item.unitId);
  const retrievedParentIds = unique(evidence.map((item) => item.parentId).filter((item): item is string => Boolean(item)));
  const hits = expectedEvidenceIds.filter((id) => evidence.some((item) => evidenceMatchesExpectedId(item, id)));
  const firstHitRank = expectedEvidenceIds.length > 0 ? firstExpectedHitRank(evidence, expectedEvidenceIds) : undefined;
  const answerFragments = expectedAnswerFragments(testCase);
  const textCorpus = evidence.map((item) => item.content).join('\n\n').toLowerCase();
  const answerContains = answerFragments.length > 0
    ? answerFragments.every((fragment) => textCorpus.includes(fragment.toLowerCase()))
    : undefined;
  const expectedRefusal = isExpectedRefusal(testCase);
  const refusalAccuracy = expectedRefusal ? (evidence.length === 0 ? 1 : 0) : undefined;
  const hitRate = expectedEvidenceIds.length > 0 ? (hits.length > 0 ? 1 : 0) : undefined;
  const score: RagEvalScore = {
    caseId: testCase.id,
    recallAtK: expectedEvidenceIds.length > 0 ? hits.length / expectedEvidenceIds.length : undefined,
    precisionAtK: expectedEvidenceIds.length > 0
      ? evidence.length > 0 ? hits.length / evidence.length : 0
      : undefined,
    mrr: expectedEvidenceIds.length > 0 ? (firstHitRank ? 1 / firstHitRank : 0) : undefined,
    hitRate,
    citationAccuracy: expectedEvidenceIds.length > 0 ? hits.length / expectedEvidenceIds.length : undefined,
    refusalAccuracy,
    answerContains,
    passed: isCasePassed({
      expectedEvidenceIds,
      answerFragments,
      expectedRefusal,
      hitRate,
      answerContains,
      refusalAccuracy,
      evidenceCount: evidence.length
    }),
    metadata: {
      ...metadata,
      expectedEvidenceIds,
      retrievedEvidenceIds,
      retrievedUnitIds,
      retrievedParentIds,
      hits,
      expectedAnswerFragments: answerFragments,
      expectedRefusal
    }
  };
  return score;
}

function isCasePassed(input: {
  expectedEvidenceIds: string[];
  answerFragments: string[];
  expectedRefusal: boolean;
  hitRate?: number;
  answerContains?: boolean;
  refusalAccuracy?: number;
  evidenceCount: number;
}): boolean {
  if (input.expectedRefusal) return input.refusalAccuracy === 1;
  const checks: boolean[] = [];
  if (input.expectedEvidenceIds.length > 0) checks.push(input.hitRate === 1);
  if (input.answerFragments.length > 0) checks.push(input.answerContains === true);
  if (checks.length === 0) return input.evidenceCount > 0;
  return checks.every(Boolean);
}

function expectedAnswerFragments(testCase: RagEvalDataset['cases'][number]): string[] {
  const metadata = asRecord(testCase.metadata);
  return unique([
    ...stringList(metadata.expectedAnswerContains),
    ...stringList(metadata.answerContains),
    ...(testCase.expectedAnswer ? [testCase.expectedAnswer] : [])
  ]);
}

function isExpectedRefusal(testCase: RagEvalDataset['cases'][number]): boolean {
  const metadata = asRecord(testCase.metadata);
  return metadata.expectedRefusal === true || metadata.shouldRefuse === true || metadata.unanswerable === true;
}

function evidenceMatchesExpectedId(evidence: RagEvidence, expectedId: string): boolean {
  const metadata = asRecord(evidence.metadata);
  const candidates = unique([
    evidence.evidenceId,
    evidence.unitId,
    evidence.parentId,
    evidence.citationLabel,
    typeof metadata.chunkId === 'string' ? metadata.chunkId : undefined,
    typeof metadata.documentId === 'string' ? metadata.documentId : undefined
  ].filter((item): item is string => Boolean(item)));
  return candidates.includes(expectedId);
}

function firstExpectedHitRank(evidence: RagEvidence[], expectedIds: string[]): number | undefined {
  for (let index = 0; index < evidence.length; index++) {
    if (expectedIds.some((id) => evidenceMatchesExpectedId(evidence[index], id))) {
      return index + 1;
    }
  }
  return undefined;
}

function metricsFromRun(run: RagEvalRun): Record<string, number> {
  const summarized = { ...summarizeEvalScores(run.scores), ...(run.summary || {}) };
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(summarized)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function numericDelta(candidate: Record<string, number>, baseline: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = new Set([...Object.keys(candidate), ...Object.keys(baseline)]);
  for (const key of keys) {
    if (candidate[key] !== undefined && baseline[key] !== undefined) {
      out[key] = roundMetric(candidate[key] - baseline[key]);
    }
  }
  return out;
}

function scoreDelta(candidate: RagEvalScore, baseline: RagEvalScore): Record<string, number> {
  const left = scoreMetrics(candidate);
  const right = scoreMetrics(baseline);
  return numericDelta(left, right);
}

function scoreMetrics(score: RagEvalScore): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of NUMERIC_SCORE_FIELDS) {
    const value = score[field];
    if (typeof value === 'number' && Number.isFinite(value)) out[field] = value;
  }
  if (typeof score.answerContains === 'boolean') out.answerContains = score.answerContains ? 1 : 0;
  if (typeof score.passed === 'boolean') out.passed = score.passed ? 1 : 0;
  return out;
}

function compareCaseStatus(
  baseline: RagEvalScore | undefined,
  candidate: RagEvalScore | undefined,
  delta: Record<string, number> | undefined
): RagEvalComparison['cases'][number]['status'] {
  if (!candidate) return 'missing_candidate';
  if (!baseline) return 'new_case';
  if (baseline.passed && !candidate.passed) return 'regressed';
  if (!baseline.passed && candidate.passed) return 'improved';
  const values = Object.values(delta || {});
  if (values.some((value) => value < 0)) return 'regressed';
  if (values.some((value) => value > 0)) return 'improved';
  return 'unchanged';
}

function averageDefined(values: Array<number | undefined>): number | undefined {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (numbers.length === 0) return undefined;
  return roundMetric(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

function normalizeFraction(value: number | undefined, fallback: number): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '')).filter(Boolean);
}

function unique(values?: Array<string | undefined>): string[] {
  return [...new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))];
}
