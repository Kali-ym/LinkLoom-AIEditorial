# Hot Story Merge: LLM Cluster Fingerprint Mode

**Date:** 2026-07-31  
**Status:** As-built (commit `27b5978`) + product contract  
**Scope:** `HotMergeMode = 'llm'` — LLM-maintained cluster fingerprints for sticky attach, without replacing `rules` / `semantic` / `hybrid`.

## Problem

`rules` / `semantic` / `hybrid` soft-merge accumulates brittle heuristics (tip/oldest anchors, entity floors, product-version backdoors, embedding filters). Root cause: **no durable cluster identity**, so paraphrases under-merge and unrelated stories over-merge.

## Goals

- One LLM judgment surface for gray-zone sticky attach, instead of growing soft-merge special cases.
- Durable, evolvable cluster identity (aliases + grounded facts) replacing regex entity patches.
- Low cost: dedicated provider/model; LLM only after hard-signature miss + coarse recall; batch + cache + seal; budget circuit breaker.
- Keep incremental sticky contract: existing `evt_*` never splits; sticky↔sticky never merges.

## Non-goals

- Do not rewrite or delete `rules` / `semantic` / `hybrid`.
- Do not assign `evt_*` at scoring-write time.
- Do not use embeddings for coarse recall in `llm` mode.
- Do not auto-split sticky clusters or merge two sticky clusters.

## Verdict on current implementation

**Direction is sound and aligned with Scheme D** (LLM-maintained cluster identity + recall → judge → evolve + fallback). The landed model (`ClusterFingerprint` with `pendingClaims` / `sealed`) is a reasonable, in places stronger, refinement of the brainstormed “cluster profile”.

**Ship-worthy core:** mode wiring, cold-start bootstrap, entity/alias recall, batched pairwise LLM judge, in-process judgment cache, claim promotion, seal/regen, rules fallback, unit + mock tests.

**Follow-ups before treating it as finished** are listed under [Known gaps](#known-gaps--follow-ups). They are correctness / coverage issues, not a redesign.

## Chosen approach (as-built Scheme D)

**Cluster fingerprint as cluster signature + pairwise LLM attach after cheap recall.**

| Piece | Role |
|-------|------|
| Hard `event_signature` attach | Zero-LLM fast path (existing) |
| Rules pre-cluster among newcomers | Cost control; LLM is **not** used to cluster newcomers among themselves |
| Entity/alias recall (top-K=3) | Candidate generation, no embedding |
| LLM pairwise judge | `same_event` + `confidence` per (item, candidate) |
| `onMerge` + optional LLM regen | Evolve aliases / discriminators; seal when stable |
| Fallback | Judge missing / failed → `rules` + `fallbackReason` |

Sticky incremental skeleton in `incrementalHotMerge.ts` is unchanged in structure.

## Architecture (runtime)

```
load sticky + fingerprints
→ hard-attach by signature (existing tip window)
→ cluster remaining newcomers with rules (llm mode forces rules here)
→ for each newcomer cluster:
     representative member → recallTopK → cache → LLM batchJudge
     match → attach all members of that newcomer cluster; onMerge(fp)
     miss  → keep as new evt_*
→ regenerateDirtyFingerprints (seal / grounded LLM distill)
→ persist fingerprints + member event_id
```

Entry: `HotStoryMergeService.runMergeAndSnapshot` when `HOT_CONFIG.mergeMode === 'llm'` constructs `LLMMergeJudge` (or null → rules fallback).

### Key modules

| Module | Responsibility |
|--------|----------------|
| `ClusterFingerprint.ts` | Types, mini-profile, bootstrap, `onMerge`, recall, seal, cache keys |
| `llmJudgePrompt.ts` | Judgment + regen system/user prompts |
| `llmMergeJudge.ts` | `tryAttach`, batch judge, regen, mem cache |
| `HotStoryMergeService.ts` | Provider wiring; `FingerprintStoreAdapter` (`data/cluster_fingerprints.json`); `JudgmentCacheAdapter` (process memory) |
| `incrementalHotMerge.ts` | `llm` branch: sticky attach via judge; bootstrap fingerprints on full merge |

## Data model: `ClusterFingerprint`

Persisted in `data/cluster_fingerprints.json` (rebuildable derivative of members).

```ts
interface ClusterFingerprint {
  eventId: string;
  seedFingerprint: string;   // compact grounded identity string
  discriminators: string[];  // distinguishing facts (often promoted claims)
  aliases: AliasEntry[];     // surface forms; drives recall
  pendingClaims: PendingClaim[]; // claim + sources count (cross-verify gate)
  memberCount: number;
  lastUpdated: string;
  sealed: boolean;           // skip regen until unsealed by promotion
}

interface ItemMiniProfile {
  itemId, signature, entities, numbers, keyFacts,
  summaryShort, publishedAt, contentHash
}
```

**Cold start (zero LLM):** `bootstrapFingerprint(eventId, seedMiniProfile)` from scoring metadata.

**Evolution (mostly zero LLM):** `onMerge` always appends new alias surfaces; accumulates `pendingClaims`; when `sources >= 2`, promotes claim into `discriminators` and may unseal.

**LLM regen:** only dirty + unsealed + has promotable claims; grounded distill of `seedFingerprint` / `discriminators`; then seal. At most one regen attempt per dirty fp per end-of-run pass.

This is intentionally richer than the brainstormed `{ canonical_title, entities, aliases, key_numbers, facts, status }`. Mapping:

| Brainstorm field | As-built |
|------------------|----------|
| `canonical_title` | `seedFingerprint` |
| `entities` + `aliases` | `aliases[]` (+ bootstrap from seed entities) |
| `facts` / `key_numbers` | `discriminators` + `pendingClaims` |
| pollution control | `pendingClaims.sources >= 2` + `sealed` |

## Config (`HotConfig`)

```ts
mergeMode: 'rules' | 'semantic' | 'hybrid' | 'llm'
llmProviderId?: string   // empty → ACTIVE_AI_PROVIDER_ID
llmModelId?: string      // empty → provider default model
llmMaxJudgmentsPerRun?: number  // default 50
llmCacheTtlMinutes?: number     // default 360
```

Hardcoded in judge construction today: `sealAfterMs = 6h`, `windowMs = REALTIME_WINDOW_MS` (36h). Judgment accept threshold: **confidence ≥ 0.6** and `same_event` (prompt also asks model to force `same_event=false` when confidence &lt; 0.6).

## Judgment & regeneration

### Judge

- Input: one mini-profile + up to K candidate fingerprints (aliases, seed, discriminators).
- Output JSON: `{ judgments: [{ pair_index, same_event, confidence, reason }] }`.
- Grouped by item so multiple candidates share one LLM call when uncached.
- Cache key: `contentHash(item)::fingerprintHash(fp)` (mem + process `JudgmentCacheAdapter`).
- First positive candidate in iteration order wins (not an exclusive multiple-choice `event_id`).

### Regen

- Prompt grounded; max short `seedFingerprint`; merge (don’t wipe) discriminators.
- Fail → keep previous fingerprint; attach already applied.

## Cost model (order of magnitude)

Hard-signature hits and cache hits dominate steady state. Gray-zone: recall K=3, budget `llmMaxJudgmentsPerRun`, regen only on cross-verified dirty clusters. Typical rebuild: small number of judge calls + 0–few regens.

## Error handling

| Case | Behavior |
|------|----------|
| Provider missing / init fail | `llmJudge = null` → attach via `rules`, `fallbackReason = llm_unavailable` |
| Batch LLM throw | `tryAttach` returns null for that path (cluster kept new or later rules path depending on branch) |
| Bad / empty JSON | Per-pair `same_event: false` |
| Over max judgments | Warn; further `tryAttach` return null |
| Regen fail | Log; keep old fp |

## Testing (as-built)

- `backend/tests/cluster-fingerprint.test.ts` — mini-profile, bootstrap, overlap, recall, onMerge promotion, seal, cache key.
- `backend/tests/llm-merge-judge.test.ts` — mock provider attach / reject / cache / budget.

Existing rules/hybrid merge tests remain the regression floor for non-`llm` modes.

## Known gaps / follow-ups

Prioritized against the product contract:

1. **New kept clusters lack fingerprints** — When LLM attach misses, `keptNew` becomes a new `evt_*` but `getOrCreateFingerprint` is not called. Next runs load sticky members without a fingerprint → LLM recall cannot target that event (hard signature still works). **Fix:** bootstrap fingerprint for every kept-new / newly assigned cluster at end of run.

2. **Hard-signature attaches skip `onMerge`** — Members glued by signature do not update aliases / pendingClaims. Fingerprint can lag reality. **Fix:** call `onMerge` (or a lighter alias ingest) on hard-attach paths.

3. **No tip publish-window gate on LLM attach** — Recall uses `lastUpdated` / `windowMs * 4` heuristics, not `withinClusterPublishWindow(members, [item])`. Can diverge from rules/hybrid time semantics. **Fix:** apply the same tip-vs-tip gate before judge.

4. **Representative-only judgment** — Attach decides from `neu.members[0]` then moves the whole newcomer cluster. Mis-clustered newcomers can over-attach. **Mitigation options:** judge oldest solid member; or require majority / refuse attach if members disagree (later).

5. **Pairwise vs exclusive choice** — Model may mark multiple candidates `same_event=true`; code takes first hit. Prefer multiple-choice `{ event_id | null }` or argmax confidence among positives.

6. **Confidence bands** — Single 0.6 threshold; no `rewriteMin` band (merge-without-regen). Promotion/`sealed` partially substitutes; document or add explicit band if ops need it.

7. **`seedFingerprint` mutability** — Comments say nearly immutable; regen may overwrite. Treat regen overwrite as intentional distillation; keep comment/docs aligned.

8. **Provider credential path** — `createAIProvider(configWithModel)` must use the same secrets resolution as other runtime AI calls; verify against `settingsSecurity` / small-model helpers if judge fails auth in production.

9. **Ops rebuild-from-members** — Comment claims rebuildability; no first-class rebuild API yet. Optional follow-up.

## Success criteria

- Gray-zone paraphrases merge without new regex/entity special cases.
- Low-confidence / non-matches do not glue unrelated in-window events.
- Typical rebuild stays within budget; fallback never empties the board.
- Sticky `evt_*` stability unchanged vs incremental semantics.
- Gaps (1)–(3) closed or explicitly accepted with documented workaround.

## Implementation touchpoints (reference)

- As-built: `ClusterFingerprint.ts`, `llmJudgePrompt.ts`, `llmMergeJudge.ts`, `HotStoryMergeService.ts`, `incrementalHotMerge.ts`, `types/config.ts`, tests above.
- Next edits: prefer closing [Known gaps](#known-gaps--follow-ups) (1)–(3) before further prompt tuning.
