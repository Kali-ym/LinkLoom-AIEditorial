import type { AgentSandboxInstance } from './AgentSandboxTypes.js';
import type { WorkspacePolicy } from './WorkspacePolicy.js';

const DEFAULT_MAX_SANDBOX_CONTAINERS = 10;
const DEFAULT_AGENT_SANDBOX_IMAGE = 'linkloom-agent:demo';

export function resolveAgentSandboxImage(policy?: WorkspacePolicy): string {
  const fromEnv = process.env.LINKLOOM_AGENT_IMAGE?.trim();
  if (fromEnv) return fromEnv;
  const fromPolicy = policy?.metadata?.image;
  const policyImage = typeof fromPolicy === 'string' ? fromPolicy.trim() : '';
  if (policyImage) return policyImage;
  return DEFAULT_AGENT_SANDBOX_IMAGE;
}

export function resolveMaxSandboxContainers(): number {
  const raw = process.env.LINKLOOM_MAX_SANDBOX_CONTAINERS;
  if (raw === undefined || raw === '') return DEFAULT_MAX_SANDBOX_CONTAINERS;
  if (raw === '0') return Number.POSITIVE_INFINITY;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_SANDBOX_CONTAINERS;
}

export function countActiveSandboxContainers(instances: AgentSandboxInstance[]): number {
  return instances.filter((row) => row.status === 'running' || row.status === 'starting').length;
}
