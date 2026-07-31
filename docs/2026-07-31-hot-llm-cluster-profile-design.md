# Hot Story Merge: LLM Cluster Profile Mode

**Date:** 2026-07-31  
**Status:** Approved for implementation  
**Scope:** Add `HotMergeMode = 'llm'` — LLM-maintained cluster signatures for event merge, without replacing `rules` / `semantic` / `hybrid`.

## Problem

Current hot-event merge (`rules` / `semantic` / `hybrid`) accumulates brittle heuristics: tip-vs-tip time windows, oldest high-score content anchors, entity Jaccard floors, single-entity text guards, versioned-product backdoors (`strongProduct`), and embedding candidate filters. These patches fight the same root issue: **member-level signals have no stable cluster identity**, so same-event paraphrases under-merge and unrelated stories over-merge. Maintainability, recall, and precision all suffer.

## Goals

- Elegant: one LLM judgment surface replaces the growing soft-merge score + special cases.
- Advanced: separate cheap recall from semantic decide; evolve a durable cluster identity.
- Low cost: dedicated LLM config allowed, but LLM only for gray-zone newcomers (after hard-signature miss + coarse recall); batch + cache; steady-state near zero LLM calls when hard-signature / cache hits dominate.
- Preserve incremental sticky contract: existing `evt_*` clusters never split; sticky↔sticky never merges.

## Non-goals

- Do not rewrite or delete `rules` / `semantic` / `hybrid` implementations.
- Do not change the scoring-stage prompt to assign `evt_*` at write time (future “scheme B”).
- Do not use embeddings for coarse recall in `llm` mode.
- Do not auto-split sticky clusters or merge two sticky clusters.

## Chosen approach (Scheme D)

**LLM-maintained cluster profile (signature) + multiple-choice attach**, with scheme A’s recall / batch / cache / fallback.

Compared with pairwise-only judging (scheme A): the LLM compares a newcomer mini-profile against **normalized cluster profiles**, not against drifting member tip/oldest text. Judgment shape is multiple-choice per newcomer (`which eventId, or none`), not O(newcomers × clusters) independent pairs (pairs may still be batched internally). Alias lists on the profile replace regex entity-normalization patches.

## Architecture

`HotMergeMode` gains `'llm'`. The incremental merge skeleton in `incrementalHotMerge.ts` stays: sticky load → hard signature attach → cluster newcomers → soft-attach to sticky → assign ids.

Only the soft-attach judgment and post-attach identity update change:

1. Load sticky clusters and their persisted **cluster profiles**.
2. Unassigned items hard-attach by normalized `event_signature` (existing; zero LLM), still respecting tip time window.
3. Remaining items form newcomer clusters (hard signature + optional light rules pre-cluster).
4. **Coarse recall** (no embedding): entity/alias overlap + tip time window → top-K sticky profiles (K ≈ 5).
5. **LLM multiple-choice judge**: mini-profile × candidate profiles → `event_id | null` + confidence.
6. On attach: mark cluster dirty; on miss: newcomer becomes a new `evt_*` with cold-start profile.
7. End of run: regenerate profile once per dirty cluster.
8. Persist `event_id` on members and updated profiles.

On LLM unavailable / failure / budget exceeded: fall back to `rules` with existing `fallbackReason` (`llm_unavailable` / `llm_failed`), optional `llmTruncated: true` in snapshot meta.

## Data model: Cluster Profile

Persisted separately keyed by `eventId` (not duplicated into every member’s metadata).

Conceptual fields:

| Field | Role |
|-------|------|
| `canonical_title` | Short grounded title for the event |
| `entities` | Core proper nouns |
| `aliases` | Alternate surface forms absorbed over time (the anti-regex mechanism) |
| `key_numbers` | Versions, sizes, dates that discriminate events |
| `facts` | Short grounded fact strings |
| `status` | Optional short lifecycle hint (e.g. released) |

Size target: ~60–120 tokens of structured JSON, not free-form essays. Field counts and string lengths are schema-capped.

**Cold start (zero LLM):** first profile for a new cluster is assembled from members’ existing scoring metadata (`event_signature`, `entities`, `numbers`, `key_facts`, `ai_summary_short`). LLM distillation runs only after growth / dirty regeneration.

**Rebuildability:** profiles are derivatives of member metadata; a polluted profile can be recomputed from members (ops path).

### Newcomer mini-profile

Same distilled shape, built from one item’s metadata only (no raw article body, no LLM): signature, entities, numbers, key_facts, summary_short (~100–200 tokens), plus a content hash for caching.

## Config (`HotConfig`)

- `mergeMode`: includes `'llm'`
- Dedicated LLM binding: `llmProviderId` + optional `llmModelId` (empty provider → fall back to active AI provider; not forced to share the scoring model)
- `llmMaxJudgmentsPerRun`: circuit breaker (default ~50)
- Confidence bands (defaults illustrative):
  - `judgeMin` (e.g. 0.7): below → `event_id = null` (do not merge)
  - `rewriteMin` (≥ `judgeMin`, e.g. 0.85): merge is allowed at/above `judgeMin`, but only members with confidence ≥ `rewriteMin` participate in profile regeneration
- `llmCacheTtlMinutes`: judgment cache TTL
- Admin `rebuildHotSnapshot` overrides accept `mergeMode: 'llm'` and the LLM provider/model ids

## Judgment & regeneration prompts

### Judge (primary cost)

Batch multiple groups in one call when possible. Each group: newcomer id + mini-profile + list of `{ eventId, profile }`.

Output: compact JSON array, e.g. `{ id, event_id, confidence }`. Rules:

- `event_id` must be in the candidate list or null
- Invented ids → treat as null + warn log
- Confidence `< judgeMin` → null
- Confidence in `[judgeMin, rewriteMin)` → merge, exclude from regen input
- Confidence ≥ `rewriteMin` → merge, eligible for regen

### Profile regeneration (secondary cost)

Only dirty clusters; at most **one rewrite per cluster per run**. Input: previous profile + mini-profiles of eligible new members this run. Output: full updated profile. Hard constraint: **grounded** — only entities/numbers/facts present in the input; no invention.

## Cost model (order of magnitude)

Example: ~20 LLM-judged newcomers, ~3 candidates each, ~150 + 3×100 tokens → ~9k input tokens, typically **one batched judge call**; ~5 dirty regenerations → **1–2 more calls**. Hard-signature hits and judgment cache hits drive steady-state toward **zero LLM calls**.

Cache key: `hash(mini-profile) + hash(candidate profile set)` (and/or fingerprint content hash). TTL configurable.

## Error handling & pollution control

| Case | Behavior |
|------|----------|
| No LLM config / provider down | `rules` + `llm_unavailable` |
| Timeout / bad JSON / schema fail | Batch discarded → `rules`; `llm_failed` |
| Invalid `event_id` in response | Treat as null |
| Over `llmMaxJudgmentsPerRun` | Remainder → `rules`; meta `llmTruncated` |
| Regen fails | Keep previous profile; member `event_id` updates still apply if attach succeeded |
| Bootstrap (no sticky) | Existing full-merge bootstrap; cold-start profiles for new clusters |

Pollution guards:

1. Grounded regen + schema caps  
2. Confidence bands: below `judgeMin` no merge; below `rewriteMin` merge without rewrite participation  
3. One regen per dirty cluster per run  
4. Rebuild-from-members escape hatch  
5. Short structured fields only — no long prose as identity

## Testing

**Unit (no LLM):** mini-profile / cold-start assembly; recall ranking + time window; JSON parse edge cases; cache key stability.

**Contract (mock LLM):** sticky attach updates `event_id` and marks dirty once; mock failure → rules fallback; low confidence skips rewrite.

**Regression:** existing `merge-hot-stories` / `incremental-hot-merge` tests stay green for `rules` / `hybrid`. Optional fixture cases for alias-heavy product launches with fixed mock outputs.

## Implementation touchpoints

- New: cluster profile types + cold-start assembly + validation; LLM judge (recall + batch judge + regen); store read/write for profiles; judgment cache
- Change: `incrementalHotMerge.ts` (`llm` branch), `HotStoryMergeService.ts`, `HotConfig` / `HotMergeMode`, admin rebuild overrides
- Leave unchanged in behavior: `rules` / `semantic` / `hybrid` paths

## Relationship to code on `main`

Commit `27b5978` (`feat: llm-based cluster for hot search`) already introduced `ClusterFingerprint`, `LLMMergeJudge`, and `HotMergeMode = 'llm'`. That work is in the same design family as this spec (aliases, cold start, recall, cache, budget). Where the landed shape differs (e.g. `seedFingerprint` / `pendingClaims` / sealing vs the profile fields above), treat **this document as the product contract**; reconcile or document intentional extensions so naming and behavior stay coherent before further expansion.

## Success criteria

- Gray-zone same-event paraphrases merge without new regex/entity special cases
- Unrelated events in-window do not glue when LLM confidence is low
- Typical rebuild stays within a small number of LLM calls; fallback never leaves the board empty
- Sticky `evt_*` stability unchanged vs current incremental semantics
