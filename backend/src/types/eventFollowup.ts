export type EventFollowupDecision = 'run' | 'skip';

export type EventFollowupStatus = 'new' | 'continued' | 'unchanged';

export type EventFollowupSkipReason =
  | 'duplicate_material'
  | 'empty_candidates'
  | 'invalid_topic_key';

export type EventFollowupRunReason = 'new_topic' | 'new_material';

export interface EventFollowupCandidate {
  title: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  factFingerprint?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedEventFollowupCandidate {
  title: string;
  titleFingerprint: string;
  materialFingerprint: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  factFingerprint?: string;
}

export interface EventFollowupState {
  topicKey: string;
  status: 'active';
  updatedAt: string;
  lastSeenDate: string;
  coveredUrls: string[];
  titleFingerprints: string[];
  materialFingerprints: string[];
  materialCount: number;
  summary?: string;
}

export interface EventFollowupEvidence {
  previousMaterialCount: number;
  currentMaterialCount: number;
  newUrls: string[];
  repeatedUrls: string[];
  newMaterialFingerprints: string[];
  repeatedMaterialFingerprints: string[];
}

export interface EventFollowupEvaluation {
  topicKey: string;
  date: string;
  decision: EventFollowupDecision;
  status: EventFollowupStatus;
  reason: EventFollowupRunReason | EventFollowupSkipReason;
  newItems: NormalizedEventFollowupCandidate[];
  duplicateItems: NormalizedEventFollowupCandidate[];
  evidence: EventFollowupEvidence;
  nextState?: EventFollowupState;
}

export interface EventFollowupEvaluateInput {
  date: string;
  topicKey: string;
  candidates: EventFollowupCandidate[];
  summary?: string;
}

export interface EventFollowupDailyRecord {
  date: string;
  updatedAt: string;
  items: EventFollowupEvaluation[];
}