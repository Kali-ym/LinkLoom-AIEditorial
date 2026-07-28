import fs from 'fs/promises';
import type { AIMessage, AIResponse } from '../../../types/index.js';
import type { AgentArtifactRef } from './AgentSession.js';
import type { ContextBuildResult, ContextPolicy } from './ContextPolicy.js';
import { TokenEstimator } from '../context/TokenEstimator.js';

export interface ContextCompactionRecord {
  compacted: boolean;
  strategy: 'none' | 'trim' | 'summarize' | 'hybrid';
  beforeMessages: number;
  afterMessages: number;
  summary?: string;
  artifactIds: string[];
  beforeTokens?: number;
  afterTokens?: number;
}

export interface ToolResultContextInput {
  runId: string;
  sessionId: string;
  toolName: string;
  toolCallId?: string;
  result: unknown;
  policy?: ContextPolicy;
}

export interface ToolResultContextOutput {
  messageContent: string;
  observationContent: string;
  data?: unknown;
  artifact?: AgentArtifactRef;
  artifactContent?: string;
}

export interface ChatMessageLike {
  role: string;
  content: string;
}

export interface ChatCompactionOptions {
  maxMessages?: number;
  maxContentChars?: number;
}

export interface ModelOutputContextInput {
  runId: string;
  sessionId: string;
  round?: number;
  content: string;
  policy?: ContextPolicy;
}

export interface ArtifactContextInput {
  runId: string;
  sessionId: string;
  kind: string;
  content: unknown;
  preview?: string;
  metadata?: Record<string, unknown>;
  policy?: ContextPolicy;
}

export interface AgentContextBuildResult extends ContextBuildResult {
  messages: AIMessage[];
  artifactIds: string[];
}

export interface ContextSummarizerInput {
  messages: AIMessage[];
  policy?: ContextPolicy;
  previousSummary?: string;
  artifactIds?: string[];
  signal?: AbortSignal;
}

export type ContextSummarizer = (
  input: ContextSummarizerInput
) => string | AIResponse | Promise<string | AIResponse>;

export interface AgentOffloader {
  offloadToolResult(input: ToolResultContextInput): ToolResultContextOutput;
  offloadModelOutput(input: ModelOutputContextInput): ToolResultContextOutput;
  offloadArtifact(input: ArtifactContextInput): { artifact: AgentArtifactRef; content: string };
  compactMessages(
    messages: AIMessage[],
    input?: { policy?: ContextPolicy; summarizer?: ContextSummarizer; signal?: AbortSignal }
  ): Promise<AgentContextBuildResult>;
  restoreArtifactRef(artifact: AgentArtifactRef): Promise<string | null>;
}

export class DefaultContextManager implements AgentOffloader {
  private readonly tokenEstimator = new TokenEstimator({ driftMultiplier: 1.15, encoding: 'o200k_base' });

  buildModelInput(messages: AIMessage[], policy?: ContextPolicy): ContextBuildResult & { messages: AIMessage[] } {
    return this.compactMessagesSync(messages, policy);
  }

  async compactMessages(
    messages: AIMessage[],
    input: { policy?: ContextPolicy; summarizer?: ContextSummarizer; signal?: AbortSignal } = {}
  ): Promise<AgentContextBuildResult> {
    const compacted = this.compactMessagesSync(messages, input.policy);
    if (!compacted.compacted || !input.summarizer || input.signal?.aborted) return compacted;

    const summaryIndex = compacted.messages.findIndex(
      (message) => message.role === 'system' && message.content === compacted.summary
    );
    if (summaryIndex < 0) return compacted;

    const olderCount = Number(compacted.metadata?.summarizedMessages || 0);
    const olderMessages = messages.filter((message) => message.role !== 'system').slice(0, olderCount);
    if (olderMessages.length === 0) return compacted;

    const summarized = await input.summarizer({
      messages: olderMessages,
      policy: input.policy,
      previousSummary: compacted.summary,
      artifactIds: compacted.artifactIds,
      signal: input.signal
    });
    if (input.signal?.aborted) return compacted;

    const summary = extractSummaryContent(summarized).trim();
    if (!summary) return compacted;

    const messagesWithSummary = compacted.messages.map((message, index) =>
      index === summaryIndex ? summaryMessage(summary) : message
    );

    return {
      ...compacted,
      messages: messagesWithSummary,
      summary,
      metadata: {
        ...compacted.metadata,
        summarySource: 'llm'
      }
    };
  }

  private compactMessagesSync(messages: AIMessage[], policy?: ContextPolicy): AgentContextBuildResult {
    const effective = this.effectivePolicy(policy);
    const strategy = effective.compactionStrategy ?? 'hybrid';
    const maxMessages = effective.maxMessages ?? 30;
    const artifactIds = extractArtifactIdsFromMessages(messages);

    const tokenBudgetTrigger = this.shouldCompactByTokenBudget(messages, effective);
    if (strategy === 'none' || !tokenBudgetTrigger) {
      return {
        messages: messages.map((message) => ({ ...message })),
        compacted: false,
        artifactIds,
        metadata: {
          strategy: 'none',
          beforeMessages: messages.length,
          afterMessages: messages.length
        }
      };
    }

    if (strategy === 'trim') {
      const trimmed = keepSystemAndRecent(messages, Math.min(maxMessages, messages.length));
      return {
        messages: trimmed,
        compacted: true,
        artifactIds,
        metadata: {
          strategy: 'trim',
          beforeMessages: messages.length,
          afterMessages: trimmed.length
        }
      };
    }

    const summarizeOlderThan = effective.summarizeOlderThanMessages ?? maxMessages;
    const recentCount = Math.min(maxMessages, summarizeOlderThan);
    const system = messages.find((message) => message.role === 'system');
    const nonSystem = messages.filter((message) => message !== system);
    const recent = nonSystem.slice(-(system ? recentCount - 1 : recentCount));
    const older = nonSystem.slice(0, Math.max(0, nonSystem.length - recent.length));
    const summary = this.summarizeHistory(older);
    const nextMessages = [
      ...(system ? [{ ...system }] : []),
      ...(summary ? [summaryMessage(summary)] : []),
      ...recent.map((message) => ({ ...message }))
    ];

    return {
      messages: nextMessages,
      compacted: true,
      summary,
      artifactIds,
      metadata: {
        strategy,
        beforeMessages: messages.length,
        afterMessages: nextMessages.length,
        summarizedMessages: older.length,
        retainedMessages: recent.length,
        summarySource: 'heuristic'
      }
    };
  }

  private shouldCompactByTokenBudget(
    messages: AIMessage[],
    policy: Pick<ContextPolicy, 'maxInputTokens' | 'reserveOutputTokens' | 'compactionBuffer'>
  ): boolean {
    const maxInputTokens = policy.maxInputTokens;
    if (!maxInputTokens) return false;
    const estimated = this.tokenEstimator.countMessages(messages);
    const reserveOutput = policy.reserveOutputTokens ?? 8192;
    const buffer = policy.compactionBuffer ?? Math.min(20000, Math.ceil(maxInputTokens * 0.1));
    const usable = maxInputTokens - reserveOutput - buffer;
    return estimated >= usable;
  }

  summarizeHistory(messages: AIMessage[]): string {
    const lines = messages
      .filter((message) => message.content && String(message.content).trim())
      .slice(-20)
      .map((message) => `${message.role}: ${truncateText(message.content, 500)}`);
    return lines.length ? `已压缩的较早上下文：\n${lines.join('\n')}` : '';
  }

  offloadToolResult(input: ToolResultContextInput): ToolResultContextOutput {
    return this.offloadArtifactValue({
      runId: input.runId,
      sessionId: input.sessionId,
      kind: 'tool_result',
      content: input.result,
      metadata: {
        toolName: input.toolName,
        toolCallId: input.toolCallId
      },
      policy: input.policy,
      inlineData: input.result,
      inlineLabel: '工具结果'
    });
  }

  offloadModelOutput(input: ModelOutputContextInput): ToolResultContextOutput {
    return this.offloadArtifactValue({
      runId: input.runId,
      sessionId: input.sessionId,
      kind: 'model_output',
      content: input.content,
      metadata: {
        round: input.round
      },
      policy: input.policy,
      inlineData: input.content,
      inlineLabel: '模型输出'
    });
  }

  offloadArtifact(input: ArtifactContextInput): { artifact: AgentArtifactRef; content: string } {
    const raw = stringifyValue(input.content);
    const policy = this.effectivePolicy(input.policy).artifactPolicy;
    const previewBytes = policy?.previewBytes ?? 1600;
    const preview = input.preview ?? truncateBytes(raw, previewBytes);
    return {
      artifact: {
        artifactId: createArtifactId(input.runId, input.kind),
        kind: input.kind,
        preview,
        sizeBytes: byteLength(raw),
        createdAt: new Date().toISOString(),
        metadata: {
          runId: input.runId,
          sessionId: input.sessionId,
          ...input.metadata
        }
      },
      content: raw
    };
  }

  async restoreArtifactRef(artifact: AgentArtifactRef): Promise<string | null> {
    const workspacePath =
      typeof artifact.metadata?.workspacePath === 'string' ? artifact.metadata.workspacePath : undefined;
    if (!workspacePath) return null;
    try {
      return await fs.readFile(workspacePath, 'utf8');
    } catch {
      return null;
    }
  }

  private offloadArtifactValue(input: ArtifactContextInput & {
    inlineData?: unknown;
    inlineLabel: string;
  }): ToolResultContextOutput {
    const policy = this.effectivePolicy(input.policy).artifactPolicy;
    const raw = stringifyValue(input.content);
    const maxInlineBytes = policy?.maxInlineBytes ?? 12000;

    if (policy?.enabled === false || byteLength(raw) <= maxInlineBytes) {
      return {
        messageContent: raw,
        observationContent: raw,
        data: input.inlineData ?? input.content
      };
    }

    const { artifact, content } = this.offloadArtifact({
      runId: input.runId,
      sessionId: input.sessionId,
      kind: input.kind,
      content: input.content,
      metadata: {
        ...input.metadata,
        inlineBytes: maxInlineBytes
      },
      policy: input.policy
    });
    const messageContent = [
      `${input.inlineLabel}已保存为 artifact: ${artifact.artifactId}`,
      `预览：${artifact.preview ?? ''}`
    ].join('\n');
    return {
      messageContent,
      observationContent: artifact.preview ?? '',
      artifact,
      artifactContent: content
    };
  }

  private effectivePolicy(policy?: ContextPolicy): ContextPolicy {
    return {
      compactionStrategy: 'hybrid',
      maxMessages: 30,
      maxInputTokens: 200000,
      reserveOutputTokens: 8192,
      compactionBuffer: 20000,
      summarizeOlderThanMessages: 24,
      ...policy,
      artifactPolicy: {
        enabled: true,
        maxInlineBytes: 12000,
        previewBytes: 1600,
        includeSourceRefs: true,
        ...policy?.artifactPolicy
      }
    };
  }
}

function keepSystemAndRecent(messages: AIMessage[], maxMessages: number): AIMessage[] {
  const system = messages.find((message) => message.role === 'system');
  const recent = messages.filter((message) => message !== system).slice(-(system ? maxMessages - 1 : maxMessages));
  return system ? [{ ...system }, ...recent.map((message) => ({ ...message }))] : recent.map((message) => ({ ...message }));
}

function summaryMessage(summary: string): AIMessage {
  return {
    role: 'system',
    content: summary
  };
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractArtifactIdsFromMessages(messages: AIMessage[]): string[] {
  const artifactIds = new Set<string>();
  for (const message of messages) {
    for (const artifactId of extractArtifactIdsFromValue(message.content)) {
      artifactIds.add(artifactId);
    }
  }
  return [...artifactIds];
}

function extractArtifactIdsFromValue(value: unknown): string[] {
  const text = value == null ? '' : stringifyValue(value);
  return [...text.matchAll(/\bartifact_[A-Za-z0-9._:-]+/g)]
    .map((match) => match[0].replace(/[.,;!?，。；：！？)\]}]+$/g, ''))
    .filter(Boolean);
}

function truncateText(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value : stringifyValue(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function truncateBytes(value: string, maxBytes: number): string {
  if (byteLength(value) <= maxBytes) return value;
  let output = '';
  for (const char of value) {
    if (byteLength(output + char) > maxBytes) break;
    output += char;
  }
  return `${output}...`;
}

function extractSummaryContent(value: string | AIResponse): string {
  return typeof value === 'string' ? value : value.content || '';
}

function createArtifactId(runId: string, toolName: string, toolCallId?: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `artifact_${runId}_${toolName}_${toolCallId || 'tool'}_${Date.now().toString(36)}_${suffix}`;
}