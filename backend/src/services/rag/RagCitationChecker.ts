import type { RagCitationCheckResult, RagEvidence } from '../../types/rag.js';

export class RagCitationChecker {
  check(answer: string, evidence: RagEvidence[]): RagCitationCheckResult {
    const available = new Set(evidence.map((item) => item.evidenceId));
    const labels = new Map(evidence.map((item) => [item.citationLabel, item.evidenceId]));
    const citationIds = extractCitationIds(answer, labels);
    const missingCitationIds = citationIds.filter((id) => !available.has(id));
    const coverage = evidence.length > 0 ? citationIds.filter((id) => available.has(id)).length / evidence.length : 0;

    if (evidence.length === 0) {
      return {
        ok: false,
        citationIds,
        missingCitationIds,
        coverage: 0,
        reason: 'no_evidence'
      };
    }

    if (citationIds.length === 0) {
      return {
        ok: false,
        citationIds,
        missingCitationIds,
        coverage,
        reason: 'missing_citation'
      };
    }

    if (missingCitationIds.length > 0) {
      return {
        ok: false,
        citationIds,
        missingCitationIds,
        coverage,
        reason: 'citation_not_found'
      };
    }

    return {
      ok: true,
      citationIds,
      missingCitationIds,
      coverage
    };
  }
}

function extractCitationIds(answer: string, labels: Map<string, string>): string[] {
  const ids = new Set<string>();
  const text = String(answer || '');
  for (const [label, evidenceId] of labels) {
    if (text.includes(label)) ids.add(evidenceId);
  }
  for (const match of text.matchAll(/\[K\d+\]/g)) {
    const label = match[0];
    ids.add(labels.get(label) || `missing:${label}`);
  }
  for (const match of text.matchAll(/knowledge:[A-Za-z0-9_-]+/g)) {
    ids.add(match[0]);
  }
  return Array.from(ids);
}