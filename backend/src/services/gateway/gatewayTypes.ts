// Gateway types — independent from binding types to keep module boundary clean.
//
// `AgentGateway` is the orchestrator: incoming message → resolve binding →
// dispatch to AgentService → return stream of GatewayEvents.

import type { ResolveStrategy, ResolveMatchLevel } from './channelBindingTypes.js';

export interface IncomingMessage {
  channel: string;
  accountId?: string | null;
  peerId?: string | null;
  text: string;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface GatewayResolution {
  agentId: string;
  bindingId: string | null;
  matchLevel: ResolveMatchLevel;
  strategy: ResolveStrategy;
  fallback: boolean;
}

export type GatewayRunStatus = 'pending' | 'started' | 'completed' | 'failed' | 'unrouted';

export interface GatewayMessageLog {
  id: string;
  channel: string;
  accountId: string | null;
  peerId: string | null;
  agentId: string | null;
  bindingId: string | null;
  matchLevel: ResolveMatchLevel | null;
  strategy: ResolveStrategy | null;
  status: GatewayRunStatus;
  textLength: number;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
  metadata: Record<string, unknown> | null;
}

// Stream events. Subset of AgentRunEvent types we re-emit to the caller.
export type GatewayEvent =
  | { type: 'gateway.started'; messageId: string; runId: string; resolution: GatewayResolution }
  | { type: 'agent.text.delta'; text: string }
  | { type: 'agent.tool.call'; name: string; args: unknown }
  | { type: 'agent.tool.result'; name: string; result: unknown }
  | { type: 'gateway.completed'; runId: string; status: 'completed' | 'failed'; error?: string; usage?: { promptTokens: number; completionTokens: number; cost: number } };

export const GATEWAY_EVENT_TYPES = [
  'gateway.started',
  'agent.text.delta',
  'agent.tool.call',
  'agent.tool.result',
  'gateway.completed',
] as const;

export type GatewayEventType = (typeof GATEWAY_EVENT_TYPES)[number];

export function isGatewayEvent(value: unknown): value is GatewayEvent {
  if (!value || typeof value !== 'object') return false;
  const t = (value as { type?: unknown }).type;
  return typeof t === 'string' && (GATEWAY_EVENT_TYPES as readonly string[]).includes(t);
}

// A handle returned by handleMessage(). `result` resolves when the run
// completes (sync mode just awaits it; stream mode also subscribes to `events`).
export interface GatewayHandle {
  messageId: string;
  runId: string | null;
  resolution: GatewayResolution | null;
  events: AsyncIterable<GatewayEvent>;
  result: Promise<GatewayCompletedPayload>;
}

export interface GatewayCompletedPayload {
  status: 'completed' | 'failed' | 'unrouted';
  output?: string;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number; cost: number };
}

export const DEFAULT_SYSTEM_AGENT_ID = 'system-default';
