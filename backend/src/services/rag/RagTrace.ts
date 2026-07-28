import { typeid } from 'typeid-js';
import type {
  RagEvidence,
  RagRetrievalTrace,
  RagRetrievalUnit,
  RagSourceFilter
} from '../../types/rag.js';

export function createRagTrace(input: {
  originalQuery: string;
  rewrittenQueries?: string[];
  filters?: RagSourceFilter[];
  units?: RagRetrievalUnit[];
  evidence?: RagEvidence[];
  retrievalStages?: RagRetrievalTrace['retrievalStages'];
  retrievalMode?: RagRetrievalTrace['retrievalMode'];
  fallbackReason?: string;
  finalContext?: string;
  answer?: string;
  citationIds?: string[];
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}): RagRetrievalTrace {
  const units = input.units || [];
  const evidence = input.evidence || [];
  return {
    traceId: typeid('ragtrace').toString(),
    originalQuery: input.originalQuery,
    rewrittenQueries: input.rewrittenQueries || [input.originalQuery],
    filters: input.filters || [],
    retrievedUnitIds: units.map((unit) => unit.unitId),
    rerankedUnitIds: units.map((unit) => unit.unitId),
    selectedEvidenceIds: evidence.map((item) => item.evidenceId),
    retrievalMode: input.retrievalMode,
    fallbackReason: input.fallbackReason,
    retrievalStages: input.retrievalStages,
    finalContext: input.finalContext,
    answer: input.answer,
    citationIds: input.citationIds || [],
    latencyMs: input.latencyMs,
    sourceTypeBreakdown: {
      knowledge: evidence.filter((item) => item.sourceType === 'knowledge').length
    },
    metadata: input.metadata
  };
}