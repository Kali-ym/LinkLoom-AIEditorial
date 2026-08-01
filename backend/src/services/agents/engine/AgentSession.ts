import { AGENT_CONTEXT_BUILDER_VERSION } from '../context/AgentContextBuilder.js';
import { PI_CONTEXT_PROTOCOL_VERSION } from '../context/PiContextTypes.js';
import type { AgentEvent, AgentHitlRequest } from './AgentEvent.js';
import type { AgentMessage, AgentRunOutput, AgentRunSource, AgentRunStatus } from './AgentRunSpec.js';
import type { PermissionRequest } from './PermissionPolicy.js';
import type { WorkspaceRef } from './WorkspacePolicy.js';
import type { AgentWorkspaceState } from '../workspace/AgentWorkspaceState.js';

export interface AgentCheckpoint {
  checkpointId: string;
  runId: string;
  sessionId: string;
  reason?: string;
  status: AgentRunStatus;
  messages: AgentMessage[];
  events?: AgentEvent[];
  pendingPermission?: PermissionRequest;
  pendingHitl?: AgentHitlRequest;
  workspace?: WorkspaceRef;
  state?: Record<string, unknown>;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AgentArtifactRef {
  artifactId: string;
  kind: string;
  uri?: string;
  preview?: string;
  sizeBytes?: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSession {
  sessionId: string;
  runId: string;
  threadId?: string;
  source: AgentRunSource;
  status: AgentRunStatus;
  currentRound?: number;
  messages: AgentMessage[];
  events: AgentEvent[];
  pendingPermission?: PermissionRequest;
  pendingHitl?: AgentHitlRequest;
  checkpoints: AgentCheckpoint[];
  artifacts: AgentArtifactRef[];
  output?: AgentRunOutput;
  workspace?: WorkspaceRef;
  workspaceState?: AgentWorkspaceState;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface PersistedPiContextMetadata {
  contextProtocolVersion: typeof PI_CONTEXT_PROTOCOL_VERSION;
  builderVersion: string;
  fingerprint?: string;
  compacted?: boolean;
  summarySource?: 'heuristic' | 'llm';
  turnId?: string;
  turnContextFingerprint?: string;
  stablePrefixHash?: string;
  variantHash?: string;
  toolsetHash?: string;
  retrieval?: {
    knowledgeScope?: unknown;
    memoryCategoryIds?: string[];
    memoryEnabled?: boolean;
  };
}

const EPHEMERAL_CONTEXT_MARKERS = ['<linkloom_context', '<retrieved_knowledge>'] as const;

export function readPersistedPiContextMetadata(
  value: unknown
): PersistedPiContextMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const nested = record.context;
  const nestedRecord =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : undefined;
  const version = nestedRecord?.contextProtocolVersion ?? record.contextProtocolVersion;
  if (version !== PI_CONTEXT_PROTOCOL_VERSION) return undefined;

  const builderVersion = readStringField(nestedRecord?.builderVersion ?? record.builderVersion);
  return {
    contextProtocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
    builderVersion: builderVersion ?? AGENT_CONTEXT_BUILDER_VERSION,
    fingerprint: readStringField(nestedRecord?.fingerprint ?? record.fingerprint),
    compacted:
      nestedRecord?.compacted === true || record.compacted === true
        ? true
        : nestedRecord?.compacted === false || record.compacted === false
          ? false
          : undefined,
    summarySource: readSummarySource(nestedRecord?.summarySource ?? record.summarySource),
    turnId: readStringField(nestedRecord?.turnId ?? record.turnId),
    turnContextFingerprint: readStringField(
      nestedRecord?.turnContextFingerprint ?? record.turnContextFingerprint
    ),
    stablePrefixHash: readStringField(nestedRecord?.stablePrefixHash ?? record.stablePrefixHash),
    variantHash: readStringField(nestedRecord?.variantHash ?? record.variantHash),
    toolsetHash: readStringField(nestedRecord?.toolsetHash ?? record.toolsetHash),
    retrieval: readRetrievalPolicy(nestedRecord?.retrieval ?? record.retrieval)
  };
}

export function serializePersistedPiContextMetadata(
  metadata: PersistedPiContextMetadata
): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    contextProtocolVersion: metadata.contextProtocolVersion,
    builderVersion: metadata.builderVersion
  };
  if (metadata.fingerprint) serialized.fingerprint = metadata.fingerprint;
  if (metadata.compacted !== undefined) serialized.compacted = metadata.compacted;
  if (metadata.summarySource) serialized.summarySource = metadata.summarySource;
  if (metadata.turnId) serialized.turnId = metadata.turnId;
  if (metadata.turnContextFingerprint) {
    serialized.turnContextFingerprint = metadata.turnContextFingerprint;
  }
  if (metadata.stablePrefixHash) serialized.stablePrefixHash = metadata.stablePrefixHash;
  if (metadata.variantHash) serialized.variantHash = metadata.variantHash;
  if (metadata.toolsetHash) serialized.toolsetHash = metadata.toolsetHash;
  if (metadata.retrieval) serialized.retrieval = metadata.retrieval;
  return toJsonSafeRecord(serialized) as Record<string, unknown>;
}

export function buildCheckpointContextMetadata(
  specMetadata: Record<string, unknown> | undefined,
  overrides: Partial<PersistedPiContextMetadata> = {}
): Record<string, unknown> {
  const base = readPersistedPiContextMetadata(specMetadata ?? {}) ?? {
    contextProtocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
    builderVersion: AGENT_CONTEXT_BUILDER_VERSION
  };
  return serializePersistedPiContextMetadata({
    ...base,
    ...overrides,
    contextProtocolVersion: PI_CONTEXT_PROTOCOL_VERSION,
    builderVersion: overrides.builderVersion ?? base.builderVersion ?? AGENT_CONTEXT_BUILDER_VERSION
  });
}

export function isValidV2CheckpointContext(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const record = metadata as Record<string, unknown>;
  const parsed = readPersistedPiContextMetadata(record);
  if (!parsed) return false;
  return parsed.builderVersion === AGENT_CONTEXT_BUILDER_VERSION;
}

export function resolveLatestValidV2Checkpoint(
  checkpoints: AgentCheckpoint[]
): AgentCheckpoint | undefined {
  for (let index = checkpoints.length - 1; index >= 0; index -= 1) {
    const checkpoint = checkpoints[index];
    if (!checkpoint) continue;
    if (!isValidV2CheckpointContext(checkpoint.metadata)) continue;
    return checkpoint;
  }
  return undefined;
}

export function assertResumeCheckpointContext(
  checkpoint: AgentCheckpoint | undefined
): void {
  if (!checkpoint?.metadata?.context) return;
  const context = checkpoint.metadata.context;
  if (!context || typeof context !== 'object' || Array.isArray(context)) return;
  const version = (context as Record<string, unknown>).contextProtocolVersion;
  if (version === PI_CONTEXT_PROTOCOL_VERSION) return;
  const error = new Error(`Unsupported context protocol version: ${String(version ?? 'missing')}`) as Error & {
    code: 'context_version_unsupported';
  };
  error.code = 'context_version_unsupported';
  throw error;
}

export function preserveRunContextMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const contextMetadata = readPersistedPiContextMetadata(metadata);
  if (!contextMetadata) return { ...metadata };

  const preservedContext = serializePersistedPiContextMetadata(contextMetadata);
  return {
    ...metadata,
    contextProtocolVersion: contextMetadata.contextProtocolVersion,
    turnId: contextMetadata.turnId,
    turnContextFingerprint: contextMetadata.turnContextFingerprint,
    stablePrefixHash: contextMetadata.stablePrefixHash,
    variantHash: contextMetadata.variantHash,
    toolsetHash: contextMetadata.toolsetHash,
    context: preservedContext
  };
}

export function mergePersistedTrajectoryMetadata(
  existing: AgentMessage[],
  next: AgentMessage[]
): AgentMessage[] {
  return next.map((message, index) => {
    const prior =
      existing[index] ??
      existing.find(
        (item) =>
          item.role === message.role &&
          item.content === message.content &&
          item.toolCallId === message.toolCallId &&
          item.name === message.name
      );
    if (!prior?.metadata || Object.keys(prior.metadata).length === 0) {
      return message;
    }
    return {
      ...message,
      metadata: {
        ...message.metadata,
        ...prior.metadata
      }
    };
  });
}

export function filterPersistentCheckpointMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages.filter((message) => !messageContainsEphemeralContext(message));
}

export function messageContainsEphemeralContext(message: AgentMessage): boolean {
  const serialized = JSON.stringify(message);
  return EPHEMERAL_CONTEXT_MARKERS.some((marker) => serialized.includes(marker));
}

function readStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readSummarySource(value: unknown): 'heuristic' | 'llm' | undefined {
  return value === 'heuristic' || value === 'llm' ? value : undefined;
}

function readRetrievalPolicy(
  value: unknown
): PersistedPiContextMetadata['retrieval'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const memoryCategoryIds = Array.isArray(record.memoryCategoryIds)
    ? record.memoryCategoryIds.filter((item): item is string => typeof item === 'string')
    : undefined;
  return {
    knowledgeScope: record.knowledgeScope,
    memoryCategoryIds,
    memoryEnabled:
      typeof record.memoryEnabled === 'boolean' ? record.memoryEnabled : undefined
  };
}

function toJsonSafeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
