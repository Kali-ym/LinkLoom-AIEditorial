// Channel binding routing types
//
// A ChannelBinding routes inbound messages from a (channel, account, peer) triple
// to a specific agent definition. Wildcards are represented as null (programmatic)
// or '*' (config/file friendly). The two forms are treated as equivalent by the
// store; '*' is normalized to null on read.
//
// matchLevel tells the caller how specific a resolve() hit was (1 = most specific,
// 4 = channel default). Useful for tracing/auditing and for "did we use a fallback"
// signals.

export const CHANNEL_BINDING_WILDCARD = '*' as const;

export interface ChannelBinding {
  id: string;
  channel: string;
  accountId: string | null;
  peerId: string | null;
  agentId: string;
  priority: number;
  isEnabled: boolean;
  description?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface ChannelBindingInput {
  id?: string;
  channel: string;
  accountId?: string | null;
  peerId?: string | null;
  agentId: string;
  priority?: number;
  isEnabled?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelBindingQuery {
  channel: string;
  accountId?: string | null;
  peerId?: string | null;
}

export interface ChannelBindingListFilter {
  channel?: string;
  agentId?: string;
  isEnabled?: boolean;
}

export type ResolveMatchLevel = 1 | 2 | 3 | 4;
export type ResolveStrategy =
  | 'specific' // (channel, account, peer) all non-null
  | 'account'  // (channel, account, *)
  | 'peer'     // (channel, *, peer)
  | 'channel'  // (channel, *, *)
  | 'fallback'; // caller-provided fallback agent

export interface ResolveResult {
  agentId: string;
  bindingId: string | null;
  matchLevel: ResolveMatchLevel;
  strategy: ResolveStrategy;
}

export const RESOLVE_STRATEGIES: readonly ResolveStrategy[] = [
  'specific',
  'account',
  'peer',
  'channel',
  'fallback',
] as const;

export const RESOLVE_MATCH_LEVELS: readonly ResolveMatchLevel[] = [1, 2, 3, 4] as const;

// Normalize a wildcard value: '*' → null, empty string → null, anything else as-is.
export function normalizeWildcard(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value === '') return null;
  if (value === CHANNEL_BINDING_WILDCARD) return null;
  return value;
}

export function isChannelBinding(value: unknown): value is ChannelBinding {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.channel === 'string' &&
    (v.accountId === null || typeof v.accountId === 'string') &&
    (v.peerId === null || typeof v.peerId === 'string') &&
    typeof v.agentId === 'string' &&
    typeof v.priority === 'number' &&
    typeof v.isEnabled === 'boolean' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
}

// Compute a stable cache key for a query — useful for in-process memoization tests.
export function queryKey(q: ChannelBindingQuery): string {
  return `${q.channel}|${normalizeWildcard(q.accountId) ?? '*'}|${normalizeWildcard(q.peerId) ?? '*'}`;
}
