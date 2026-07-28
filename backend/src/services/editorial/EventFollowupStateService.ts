import type { LocalStore } from '../LocalStore.js';
import type {
  EventFollowupCandidate,
  EventFollowupDailyRecord,
  EventFollowupEvaluateInput,
  EventFollowupEvaluation,
  EventFollowupEvidence,
  EventFollowupState,
  NormalizedEventFollowupCandidate
} from '../../types/eventFollowup.js';

const STATE_KEY_PREFIX = 'event_followup_state:';
const DAILY_KEY_PREFIX = 'event_followup:';

function normalizeDate(date: string): string {
  return String(date || '').slice(0, 10);
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\p{P}\p{S}\s]+/gu, ' ')
    .trim();
}

function stableFingerprint(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  let hash = 0x811c9dc5;
  for (const ch of normalized) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeUrl(url: unknown): string | undefined {
  const raw = String(url || '').trim();
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return raw;
  }
}

function normalizeCandidate(candidate: EventFollowupCandidate): NormalizedEventFollowupCandidate | null {
  const title = String(candidate.title || '').trim();
  const url = normalizeUrl(candidate.url);
  const source = String(candidate.source || '').trim() || undefined;
  const summary = String(candidate.summary || '').trim() || undefined;
  const factFingerprint = String(candidate.factFingerprint || '').trim() || undefined;
  const titleFingerprint = stableFingerprint(title);
  const materialFingerprint = factFingerprint || stableFingerprint([url, title, source].filter(Boolean).join(' '));

  if (!title || !materialFingerprint) return null;

  return {
    title,
    titleFingerprint,
    materialFingerprint,
    url,
    source,
    publishedAt: candidate.publishedAt,
    summary,
    factFingerprint
  };
}

function normalizeCandidates(candidates: EventFollowupCandidate[]): NormalizedEventFollowupCandidate[] {
  const out: NormalizedEventFollowupCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (!normalized || seen.has(normalized.materialFingerprint)) continue;
    seen.add(normalized.materialFingerprint);
    out.push(normalized);
  }
  return out;
}

function toState(value: unknown): EventFollowupState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Partial<EventFollowupState>;
  if (!state.topicKey || !Array.isArray(state.materialFingerprints)) return undefined;
  return {
    topicKey: String(state.topicKey),
    status: 'active',
    updatedAt: String(state.updatedAt || ''),
    lastSeenDate: String(state.lastSeenDate || ''),
    coveredUrls: uniqueStrings(state.coveredUrls || []),
    titleFingerprints: uniqueStrings(state.titleFingerprints || []),
    materialFingerprints: uniqueStrings(state.materialFingerprints || []),
    materialCount:
      typeof state.materialCount === 'number' ? state.materialCount : state.materialFingerprints.length,
    summary: typeof state.summary === 'string' ? state.summary : undefined
  };
}

function buildEvidence(
  previous: EventFollowupState | undefined,
  candidates: NormalizedEventFollowupCandidate[],
  newItems: NormalizedEventFollowupCandidate[],
  duplicateItems: NormalizedEventFollowupCandidate[]
): EventFollowupEvidence {
  return {
    previousMaterialCount: previous?.materialCount ?? 0,
    currentMaterialCount: candidates.length,
    newUrls: uniqueStrings(newItems.map((item) => item.url)),
    repeatedUrls: uniqueStrings(duplicateItems.map((item) => item.url)),
    newMaterialFingerprints: uniqueStrings(newItems.map((item) => item.materialFingerprint)),
    repeatedMaterialFingerprints: uniqueStrings(
      duplicateItems.map((item) => item.materialFingerprint)
    )
  };
}

function buildNextState(input: {
  date: string;
  topicKey: string;
  previous?: EventFollowupState;
  candidates: NormalizedEventFollowupCandidate[];
  summary?: string;
  nowIso: string;
}): EventFollowupState {
  const previous = input.previous;
  return {
    topicKey: input.topicKey,
    status: 'active',
    updatedAt: input.nowIso,
    lastSeenDate: input.date,
    coveredUrls: uniqueStrings([
      ...(previous?.coveredUrls || []),
      ...input.candidates.map((item) => item.url)
    ]),
    titleFingerprints: uniqueStrings([
      ...(previous?.titleFingerprints || []),
      ...input.candidates.map((item) => item.titleFingerprint)
    ]),
    materialFingerprints: uniqueStrings([
      ...(previous?.materialFingerprints || []),
      ...input.candidates.map((item) => item.materialFingerprint)
    ]),
    materialCount: uniqueStrings([
      ...(previous?.materialFingerprints || []),
      ...input.candidates.map((item) => item.materialFingerprint)
    ]).length,
    summary: input.summary || previous?.summary
  };
}

export class EventFollowupStateService {
  constructor(private readonly store: Pick<LocalStore, 'get' | 'put'>) {}

  stateKey(topicKey: string): string {
    return `${STATE_KEY_PREFIX}${topicKey}`;
  }

  dailyKey(date: string): string {
    return `${DAILY_KEY_PREFIX}${normalizeDate(date)}`;
  }

  async getState(topicKey: string): Promise<EventFollowupState | undefined> {
    return toState(await this.store.get(this.stateKey(topicKey)));
  }

  async evaluate(input: EventFollowupEvaluateInput): Promise<EventFollowupEvaluation> {
    const topicKey = String(input.topicKey || '').trim();
    const date = normalizeDate(input.date);
    const candidates = normalizeCandidates(input.candidates || []);
    const previous = topicKey ? await this.getState(topicKey) : undefined;
    const previousMaterial = new Set(previous?.materialFingerprints || []);

    if (!topicKey) {
      return {
        topicKey,
        date,
        decision: 'skip',
        status: 'unchanged',
        reason: 'invalid_topic_key',
        newItems: [],
        duplicateItems: candidates,
        evidence: buildEvidence(previous, candidates, [], candidates)
      };
    }

    if (candidates.length === 0) {
      return {
        topicKey,
        date,
        decision: 'skip',
        status: 'unchanged',
        reason: 'empty_candidates',
        newItems: [],
        duplicateItems: [],
        evidence: buildEvidence(previous, candidates, [], [])
      };
    }

    const newItems = candidates.filter((item) => !previousMaterial.has(item.materialFingerprint));
    const duplicateItems = candidates.filter((item) => previousMaterial.has(item.materialFingerprint));
    const evidence = buildEvidence(previous, candidates, newItems, duplicateItems);

    if (newItems.length === 0) {
      return {
        topicKey,
        date,
        decision: 'skip',
        status: 'unchanged',
        reason: 'duplicate_material',
        newItems,
        duplicateItems,
        evidence
      };
    }

    const nowIso = new Date().toISOString();
    const nextState = buildNextState({
      date,
      topicKey,
      previous,
      candidates,
      summary: input.summary,
      nowIso
    });

    return {
      topicKey,
      date,
      decision: 'run',
      status: previous ? 'continued' : 'new',
      reason: previous ? 'new_material' : 'new_topic',
      newItems,
      duplicateItems,
      evidence,
      nextState
    };
  }

  async commit(evaluation: EventFollowupEvaluation): Promise<void> {
    if (evaluation.nextState) {
      await this.store.put(this.stateKey(evaluation.topicKey), evaluation.nextState);
    }

    const key = this.dailyKey(evaluation.date);
    const existing = (await this.store.get(key)) as Partial<EventFollowupDailyRecord> | undefined;
    const previousItems = Array.isArray(existing?.items) ? existing.items : [];
    const withoutTopic = previousItems.filter((item) => item.topicKey !== evaluation.topicKey);
    const record: EventFollowupDailyRecord = {
      date: evaluation.date,
      updatedAt: new Date().toISOString(),
      items: [...withoutTopic, evaluation]
    };
    await this.store.put(key, record);
  }

  async evaluateAndCommit(input: EventFollowupEvaluateInput): Promise<EventFollowupEvaluation> {
    const evaluation = await this.evaluate(input);
    await this.commit(evaluation);
    return evaluation;
  }
}