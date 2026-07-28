import { createHash } from 'crypto';
import type { AgentDefinition } from '../../../types/agent.js';
import { normalizeSystemPrompt } from '../prompt/normalizeSystemPrompt.js';
import type { StructuredPrompt } from '../prompt/types.js';

export const AGENT_SPEC_SCHEMA_VERSION = 'agent-spec-v1';

export interface AgentSpecSnapshot {
  schemaVersion: typeof AGENT_SPEC_SCHEMA_VERSION;
  specId: string;
  revision: string;
  agentId: string;
  name: string;
  description: string;
  prompt: {
    system: StructuredPrompt;
  };
  model: {
    providerId: string;
    model: string;
    temperature: number;
    streaming?: boolean;
  };
  tools: {
    toolIds: string[];
    skillIds: string[];
    mcpServerIds: string[];
  };
  knowledge?: {
    scope?: AgentDefinition['knowledgeScope'];
    readCategoryIds?: string[];
    writeCategoryIds?: string[];
  };
  memory?: {
    readCategoryIds?: string[];
    writeCategoryIds?: string[];
  };
  runtime?: AgentDefinition['runtime'];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function createAgentSpecSnapshot(agentDef: AgentDefinition, createdAt = new Date().toISOString()): AgentSpecSnapshot {
  const normalized = normalizeAgentSpec(agentDef);
  const revision = createRevision(normalized);
  return {
    schemaVersion: AGENT_SPEC_SCHEMA_VERSION,
    specId: `${agentDef.id}@${revision}`,
    revision,
    agentId: agentDef.id,
    createdAt,
    ...normalized
  };
}

function normalizeAgentSpec(agentDef: AgentDefinition): Omit<AgentSpecSnapshot, 'schemaVersion' | 'specId' | 'revision' | 'agentId' | 'createdAt'> {
  return removeUndefined({
    name: agentDef.name,
    description: agentDef.description,
    prompt: {
      system: normalizeSystemPrompt(agentDef.systemPrompt)
    },
    model: removeUndefined({
      providerId: agentDef.providerId,
      model: agentDef.model,
      temperature: agentDef.temperature,
      streaming: agentDef.streaming
    }),
    tools: {
      toolIds: stableStringList(agentDef.toolIds),
      skillIds: stableStringList(agentDef.skillIds),
      mcpServerIds: stableStringList(agentDef.mcpServerIds)
    },
    knowledge: removeEmptyObject({
      scope: agentDef.knowledgeScope ? sortJsonValue(agentDef.knowledgeScope) as AgentDefinition['knowledgeScope'] : undefined,
      readCategoryIds: stableStringList(agentDef.knowledgeCategoryIds),
      writeCategoryIds: stableStringList(agentDef.knowledgeSaveCategoryIds)
    }),
    memory: removeEmptyObject({
      readCategoryIds: stableStringList(agentDef.memoryCategoryIds),
      writeCategoryIds: stableStringList(agentDef.memorySaveCategoryIds)
    }),
    runtime: agentDef.runtime ? sortJsonValue(agentDef.runtime) as AgentDefinition['runtime'] : undefined,
    metadata: normalizeMetadata(agentDef.metadata)
  });
}

function createRevision(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}

function stableStringList(values: string[] | undefined): string[] {
  return [...(values ?? [])].filter((value) => typeof value === 'string' && value.length > 0).sort();
}

function normalizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const normalized = sortJsonValue(metadata);
  return isNonEmptyRecord(normalized) ? normalized : undefined;
}

function removeEmptyObject<T extends Record<string, unknown>>(value: T): T | undefined {
  const next = removeUndefined(value);
  return Object.keys(next).length > 0 ? next : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined)
  ) as T;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJsonValue(item));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJsonValue(child)])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0;
}