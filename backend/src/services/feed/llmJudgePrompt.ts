/**
 * LLM prompt templates for hot story cluster merge judgments
 * and fingerprint regeneration.
 */

import type { ClusterFingerprint, ItemMiniProfile } from './ClusterFingerprint.js';

// ── Pairwise judgment prompt ───────────────────────────────────────────────

export const JUDGMENT_SYSTEM_PROMPT = `You are an event clustering judge. Determine whether a news article belongs to an existing event cluster.

Input:
- An article's "mini profile" (signature, entities, numbers, key facts, short summary)
- One or more candidate cluster "fingerprints" (seed facts, discriminators, aliases)

Judgment criteria: the article and the cluster describe THE SAME SPECIFIC EVENT (same product launch, same policy change, same incident, etc.), not merely the same domain or company.

Output STRICT JSON only, no markdown:
{"judgments":[{"pair_index":0,"same_event":true,"confidence":0.92,"reason":"both report Kimi K3 release on same date"}]}

- confidence: 0.0–1.0
- If confidence < 0.6, set same_event to false
- Judge each pair independently`;

export function buildJudgmentUserPrompt(
  item: ItemMiniProfile,
  candidates: ClusterFingerprint[]
): string {
  const lines: string[] = [];

  lines.push('Article:');
  lines.push(`  signature: ${item.signature}`);
  lines.push(`  entities: ${item.entities.join(', ')}`);
  lines.push(`  numbers: ${item.numbers.join(', ')}`);
  lines.push(`  key facts: ${item.keyFacts.join('; ')}`);
  lines.push(`  summary: ${item.summaryShort}`);
  lines.push('');

  candidates.forEach((fp, i) => {
    lines.push(`Candidate cluster ${i}:`);
    lines.push(`  fingerprint: ${fp.seedFingerprint}`);
    lines.push(`  discriminators: ${fp.discriminators.join('; ')}`);
    lines.push(`  aliases: ${fp.aliases.map((a) => a.surface).join(', ')}`);
    lines.push('  ---END---');
    lines.push('');
  });

  lines.push(
    `Judge whether the article belongs to each candidate cluster (0–${candidates.length - 1}).`
  );
  lines.push('Return JSON for each pair.');

  return lines.join('\n');
}

// ── Fingerprint regeneration prompt ────────────────────────────────────────

export const REGEN_SYSTEM_PROMPT = `You are an event fingerprint distiller. Compress event cluster information into a compact fingerprint.

Rules:
- The fingerprint must be grounded in provided facts only — never hallucinate.
- seedFingerprint format: "EntityA + EntityB + event type + date" (max 60 chars)
- discriminators: 3–5 most distinguishing features
- Output STRICT JSON only, no markdown`;

export function buildRegenUserPrompt(fp: ClusterFingerprint): string {
  const promotedClaims = fp.pendingClaims.filter((c) => c.sources >= 2);
  const newAliases = fp.aliases.slice(-5); // recent aliases only

  const lines: string[] = [];

  lines.push(`Cluster event ID: ${fp.eventId}`);
  lines.push(`Member count: ${fp.memberCount}`);
  lines.push(`Current fingerprint: ${fp.seedFingerprint}`);
  lines.push(`Existing discriminators: ${fp.discriminators.join('; ')}`);
  lines.push(
    `Cross-verified facts (sources >= 2): ${promotedClaims.map((c) => c.claim).join('; ')}`
  );
  lines.push(`Recent aliases: ${newAliases.map((a) => a.surface).join(', ')}`);
  lines.push('');
  lines.push('Output JSON: {"seedFingerprint":"...","discriminators":["...","..."]}');

  return lines.join('\n');
}
