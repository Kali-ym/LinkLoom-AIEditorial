import type { ReActRuntimeOptions } from '../runtime/ReActRuntime.js';
import type {
  AgentEvent,
  AgentEventListener,
  AgentHitlResolution
} from './AgentEvent.js';
import type { AgentMiddleware } from './AgentMiddleware.js';
import type { AgentRunOutput, AgentRunSpec, AgentRunStatus } from './AgentRunSpec.js';
import type { AgentSession } from './AgentSession.js';
import type { PermissionDecision } from './PermissionPolicy.js';

export interface AgentRunHandle {
  runId: string;
  sessionId: string;
  status: AgentRunStatus;
  events: AsyncIterable<AgentEvent>;
  abort: (reason?: string) => Promise<void>;
}

export interface AgentRunOptions {
  middleware?: AgentMiddleware[];
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface AgentResumeOptions extends AgentRunOptions {
  runId?: string;
  decision?: PermissionDecision;
  checkpointId?: string;
  runtimeOptions?: ReActRuntimeOptions;
}

export interface AgentHitlResumeOptions extends AgentRunOptions {
  runId?: string;
  resolution: AgentHitlResolution;
  checkpointId?: string;
  runtimeOptions?: ReActRuntimeOptions;
}

export interface AgentEngine {
  prepareRun(spec: AgentRunSpec): Promise<void>;
  run(spec: AgentRunSpec, options?: AgentRunOptions): Promise<AgentRunOutput>;
  stream(spec: AgentRunSpec, options?: AgentRunOptions): Promise<AgentRunHandle>;
  resume(sessionId: string, options?: AgentResumeOptions): Promise<AgentRunOutput>;
  resumeHitl(sessionId: string, options: AgentHitlResumeOptions): Promise<AgentRunOutput>;
  getSession(sessionId: string): Promise<AgentSession | null>;
  getSessionByRunId(runId: string): Promise<AgentSession | null>;
  getSessionsBySessionId(sessionId: string): Promise<AgentSession[]>;
  getSessionsByThreadId(threadId: string): Promise<AgentSession[]>;
  listSessions(): Promise<AgentSession[]>;
  cancelRun(runId: string, reason?: string): Promise<{ status: AgentRunStatus }>;
  archiveRun(runId: string, reason?: string): Promise<{ status: AgentRunStatus }>;
  saveRunSession(session: AgentSession): Promise<void>;
  getEvents(runId: string): Promise<AgentEvent[]>;
  subscribe(runId: string, listener: AgentEventListener): () => void;
}