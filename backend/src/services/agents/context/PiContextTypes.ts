import type { ToolDefinition } from '../../../types/agent.js';
import type { AgentMessage } from '../engine/AgentRunSpec.js';
import type { AIMessage } from '../../../types/index.js';
import { hashString, stableStringify } from '../engine/canonicalMessageSerializer.js';

export const PI_CONTEXT_PROTOCOL_VERSION = 'pi-context-v2' as const;
export type ContextProtocolVersion = typeof PI_CONTEXT_PROTOCOL_VERSION;
export type SessionTrajectory = AgentMessage[];

export type ContextSource =
  | 'knowledge'
  | 'memory'
  | 'date'
  | 'workspace'
  | 'runtime';

export type ContextTrust = 'untrusted_data' | 'runtime_metadata';

export interface ContextMessage {
  id: string;
  turnId: string;
  source: ContextSource;
  content: string;
  trust: ContextTrust;
  instructionPolicy: 'reference_only';
  persist: false;
}

export interface TurnContext {
  turnId: string;
  sources: ContextMessage[];
  sourceErrors: TurnContextSourceError[];
  fingerprint: string;
}

export interface TurnContextSourceError {
  source: ContextSource;
  code: 'unavailable';
}

export interface SessionContext {
  protocolVersion: typeof PI_CONTEXT_PROTOCOL_VERSION;
  stableSystemPrompt: string;
  variantMessages: AIMessage[];
  trajectory: AIMessage[];
  providerTools: ToolDefinition[];
  stablePrefixHash: string;
  variantHash: string;
  toolsetHash: string;
}

export interface LlmRequestContext {
  systemInstruction: string;
  messages: AIMessage[];
  providerTools: ToolDefinition[];
  ephemeralMessages: ContextMessage[];
  turnContextFingerprint: string;
  diagnostics?: string[];
}

export interface TurnContextSourceInput {
  source: ContextSource;
  content: string;
  trust?: ContextTrust;
}

export function createTurnContext(input: {
  turnId: string;
  sources: TurnContextSourceInput[];
  sourceErrors?: TurnContextSourceError[];
}): TurnContext {
  const sources = input.sources
    .filter((source) => source.content.trim().length > 0)
    .map((source, index): ContextMessage => ({
      id: `${input.turnId}:${source.source}:${index}`,
      turnId: input.turnId,
      source: source.source,
      content: source.content,
      trust:
        source.source === 'knowledge' || source.source === 'memory'
          ? 'untrusted_data'
          : source.trust ?? 'runtime_metadata',
      instructionPolicy: 'reference_only',
      persist: false,
    }));

  return {
    turnId: input.turnId,
    sources,
    sourceErrors: [...(input.sourceErrors ?? [])],
    fingerprint: hashString(
      stableStringify({
        turnId: input.turnId,
        sources: sources.map(({ id, ...source }) => source),
        sourceErrors: input.sourceErrors ?? [],
      }),
    ),
  };
}
