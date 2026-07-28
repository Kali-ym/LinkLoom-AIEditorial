/** Backend permission / HITL DTOs (aligned with backend PermissionPolicy + AgentEvent). */

export interface BackendPermissionSubject {
  toolName: string;
  exposedName?: string;
  originalName?: string;
  mcpServerId?: string;
  actionKind?: string;
  riskLevel?: string;
  resourceUri?: string;
  metadata?: Record<string, unknown>;
}

export interface BackendPermissionRequest {
  permissionId: string;
  runId: string;
  sessionId: string;
  subject: BackendPermissionSubject;
  arguments: unknown;
  reason?: string;
  requestedAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BackendPermissionDecision {
  permissionId: string;
  effect: 'allow' | 'ask' | 'deny';
  reason?: string;
  resolvedBy?: string;
  resolvedAt: string;
  editedArguments?: unknown;
  metadata?: Record<string, unknown>;
}

export interface BackendHitlRequest {
  requestId: string;
  kind: string;
  status?: 'pending';
  prompt?: string;
  schema?: unknown;
  proposedArguments?: unknown;
  allowedActions?: string[];
  permissionId?: string;
  checkpointId?: string;
  createdAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}
