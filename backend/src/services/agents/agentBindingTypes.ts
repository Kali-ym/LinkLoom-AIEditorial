export type AgentResourceType = 'kb_category' | 'kb_document' | 'file';

export interface AgentResourceBinding {
  id: string;
  agentId: string;
  resourceType: AgentResourceType;
  resourceId: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResourceBindingInput {
  resourceType: AgentResourceType;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export const AGENT_RESOURCE_TYPES: readonly AgentResourceType[] = [
  'kb_category',
  'kb_document',
  'file',
] as const;

export function isAgentResourceType(value: unknown): value is AgentResourceType {
  return typeof value === 'string' && (AGENT_RESOURCE_TYPES as readonly string[]).includes(value);
}
