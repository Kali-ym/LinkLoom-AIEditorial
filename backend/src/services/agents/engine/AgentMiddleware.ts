import type { AgentEvent } from './AgentEvent.js';
import type { AgentRunOutput, AgentRunSpec } from './AgentRunSpec.js';
import type { PermissionDecision, PermissionRequest } from './PermissionPolicy.js';

export interface AgentMiddlewareContext {
  spec: AgentRunSpec;
  metadata: Record<string, unknown>;
  emit: (event: AgentEvent) => void | Promise<void>;
}

export interface AgentModelCallContext extends AgentMiddlewareContext {
  messages: unknown[];
  providerId?: string;
  model?: string;
}

export interface AgentToolCallContext extends AgentMiddlewareContext {
  toolName: string;
  arguments: unknown;
  permission?: PermissionRequest | PermissionDecision;
}

export interface AgentMiddleware {
  name: string;
  beforeRun?: (ctx: AgentMiddlewareContext) => void | Promise<void>;
  beforeModelCall?: (ctx: AgentModelCallContext) => void | Promise<void>;
  afterModelCall?: (ctx: AgentModelCallContext & { result: unknown }) => void | Promise<void>;
  beforeToolCall?: (ctx: AgentToolCallContext) => void | Promise<void>;
  afterToolCall?: (ctx: AgentToolCallContext & { result: unknown }) => void | Promise<void>;
  beforeFinish?: (ctx: AgentMiddlewareContext & { output: AgentRunOutput }) => void | Promise<void>;
  onError?: (ctx: AgentMiddlewareContext & { error: unknown }) => void | Promise<void>;
}