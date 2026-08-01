import type { AIMessage } from '../../../types/index.js';
import type { AgentCheckpoint } from '../engine/AgentSession.js';
import {
  DefaultContextManager,
  type AgentContextBuildResult,
  type ContextSummarizer
} from '../engine/ContextManager.js';
import type { ContextPolicy } from '../engine/ContextPolicy.js';
import {
  canonicalizeAIMessages,
  hashString,
  stableStringify
} from '../engine/canonicalMessageSerializer.js';

export const AGENT_CONTEXT_BUILDER_VERSION = 'agent-context-v2' as const;

export interface AgentContextLayers {
  stablePrefixMessages: AIMessage[];
  trajectoryMessages: AIMessage[];
}

export interface AgentContextSnapshot {
  messages: AIMessage[];
  layers: AgentContextLayers;
  compacted: boolean;
  summary?: string;
  artifactIds: string[];
  fingerprint: string;
  metadata: Record<string, unknown>;
}

export interface AgentContextInitialInput {
  stablePrefixMessages: AIMessage[];
  trajectoryMessages: AIMessage[];
}

export interface AgentContextCompactionInput {
  policy?: ContextPolicy;
  summarizer?: ContextSummarizer;
  signal?: AbortSignal;
}

export interface AgentContextCompactionResult extends AgentContextBuildResult {
  fingerprint: string;
  builderVersion: typeof AGENT_CONTEXT_BUILDER_VERSION;
  summarySource?: 'heuristic' | 'llm';
}

export class AgentContextBuilder {
  constructor(
    private readonly contextManager: DefaultContextManager = new DefaultContextManager()
  ) {}

  buildInitial(input: AgentContextInitialInput): AgentContextSnapshot {
    const layers: AgentContextLayers = {
      stablePrefixMessages: cloneMessages(input.stablePrefixMessages),
      trajectoryMessages: cloneMessages(input.trajectoryMessages)
    };

    return this.createSnapshot(
      [...layers.stablePrefixMessages, ...layers.trajectoryMessages],
      layers,
      {
        compacted: false,
        artifactIds: []
      }
    );
  }

  snapshotFromMessages(
    messages: AIMessage[],
    input: {
      compacted?: boolean;
      summary?: string;
      artifactIds?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): AgentContextSnapshot {
    const cloned = cloneMessages(messages);
    return this.createSnapshot(cloned, partitionMessages(cloned), {
      compacted: input.compacted ?? false,
      summary: input.summary,
      artifactIds: input.artifactIds ?? [],
      metadata: input.metadata
    });
  }

  buildFromCheckpoint(
    checkpoint: AgentCheckpoint,
    messages: AIMessage[]
  ): AgentContextSnapshot | null {
    if (!Array.isArray(messages) || messages.some((message) => !isRuntimeMessage(message))) {
      return null;
    }

    const rawContext = checkpoint.metadata?.context;
    const context = isRecord(rawContext) ? rawContext : undefined;
    const builderVersion = context?.builderVersion;
    if (builderVersion !== undefined && builderVersion !== AGENT_CONTEXT_BUILDER_VERSION) {
      return null;
    }

    const artifactIds = readStringArray(context?.artifactIds);
    const metadata = {
      ...(context ?? {}),
      builderVersion: AGENT_CONTEXT_BUILDER_VERSION
    };
    const snapshot = this.snapshotFromMessages(messages, {
      compacted: context?.compacted === true,
      summary: typeof context?.summary === 'string' ? context.summary : undefined,
      artifactIds,
      metadata
    });

    const expectedFingerprint = context?.fingerprint;
    if (
      typeof expectedFingerprint === 'string' &&
      expectedFingerprint.length > 0 &&
      expectedFingerprint !== snapshot.fingerprint
    ) {
      return null;
    }

    return snapshot;
  }

  async compactMessages(
    messages: AIMessage[],
    input: AgentContextCompactionInput = {}
  ): Promise<AgentContextCompactionResult> {
    const result = await this.contextManager.compactMessages(messages, input);
    const summarySource =
      result.metadata?.summarySource === 'llm' ? 'llm' : result.summary ? 'heuristic' : undefined;
    const fingerprint = this.createFingerprint(result.messages, {
      summary: result.summary,
      summarySource,
      artifactIds: result.artifactIds,
      summarizedMessages: result.metadata?.summarizedMessages,
      retainedMessages: result.metadata?.retainedMessages
    });

    return {
      ...result,
      fingerprint,
      builderVersion: AGENT_CONTEXT_BUILDER_VERSION,
      summarySource
    };
  }

  replaceMessagesInPlace(target: AIMessage[], replacement: AIMessage[]): void {
    target.splice(0, target.length, ...cloneMessages(replacement));
  }

  createFingerprint(
    messages: AIMessage[],
    metadata: {
      summary?: string;
      summarySource?: string;
      artifactIds?: string[];
      summarizedMessages?: unknown;
      retainedMessages?: unknown;
    } = {}
  ): string {
    return hashString(
      stableStringify({
        builderVersion: AGENT_CONTEXT_BUILDER_VERSION,
        messages: canonicalizeAIMessages(messages, {
          keepReasoning: true,
          keepRawParts: true
        }),
        summary: metadata.summary ?? null,
        summarySource: metadata.summarySource ?? null,
        artifactIds: [...(metadata.artifactIds ?? [])].sort(),
        summarizedMessages: metadata.summarizedMessages ?? null,
        retainedMessages: metadata.retainedMessages ?? null
      })
    );
  }

  private createSnapshot(
    messages: AIMessage[],
    layers: AgentContextLayers,
    input: {
      compacted: boolean;
      summary?: string;
      artifactIds: string[];
      metadata?: Record<string, unknown>;
    }
  ): AgentContextSnapshot {
    const metadata: Record<string, unknown> = {
      ...(input.metadata ?? {}),
      builderVersion: AGENT_CONTEXT_BUILDER_VERSION
    };
    const fingerprint = this.createFingerprint(messages, {
      summary: input.summary,
      summarySource:
        typeof metadata.summarySource === 'string' ? metadata.summarySource : undefined,
      artifactIds: input.artifactIds,
      summarizedMessages: metadata.summarizedMessages,
      retainedMessages: metadata.retainedMessages
    });

    return {
      messages: cloneMessages(messages),
      layers: cloneLayers(layers),
      compacted: input.compacted,
      summary: input.summary,
      artifactIds: [...input.artifactIds],
      fingerprint,
      metadata
    };
  }
}

function partitionMessages(messages: AIMessage[]): AgentContextLayers {
  const firstSystemIndex = messages.findIndex((message) => message.role === 'system');
  const stableEnd = firstSystemIndex >= 0 ? firstSystemIndex + 1 : 0;
  return {
    stablePrefixMessages: cloneMessages(
      firstSystemIndex >= 0 ? messages.slice(firstSystemIndex, stableEnd) : []
    ),
    trajectoryMessages: cloneMessages(
      firstSystemIndex >= 0 ? messages.slice(stableEnd) : messages
    )
  };
}

function cloneLayers(layers: AgentContextLayers): AgentContextLayers {
  return {
    stablePrefixMessages: cloneMessages(layers.stablePrefixMessages),
    trajectoryMessages: cloneMessages(layers.trajectoryMessages)
  };
}

function cloneMessages(messages: AIMessage[]): AIMessage[] {
  return messages.map((message) => ({
    ...message,
    content: cloneValue(message.content) as AIMessage['content'],
    ...(Array.isArray(message.tool_calls)
      ? { tool_calls: cloneValue(message.tool_calls) as AIMessage['tool_calls'] }
      : {}),
    ...(Array.isArray(message.raw_parts)
      ? { raw_parts: cloneValue(message.raw_parts) as AIMessage['raw_parts'] }
      : {})
  }));
}

function cloneValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
}

function isRuntimeMessage(value: unknown): value is AIMessage {
  if (!isRecord(value)) return false;
  return (
    (value.role === 'system' ||
      value.role === 'user' ||
      value.role === 'assistant' ||
      value.role === 'tool' ||
      value.role === 'developer') &&
    'content' in value
  );
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
