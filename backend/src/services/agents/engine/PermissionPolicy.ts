export type PermissionEffect = 'allow' | 'ask' | 'deny';

export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type PermissionActionKind =
  | 'read'
  | 'query'
  | 'write'
  | 'delete'
  | 'publish'
  | 'execute_command'
  | 'network'
  | 'unknown';

export interface PermissionSubject {
  toolName: string;
  exposedName?: string;
  originalName?: string;
  mcpServerId?: string;
  actionKind?: PermissionActionKind;
  riskLevel?: PermissionRiskLevel;
  resourceUri?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionPolicyRule {
  id: string;
  description?: string;
  match: Partial<PermissionSubject>;
  effect: PermissionEffect;
  reason?: string;
}

export interface PermissionPolicy {
  defaultEffect: PermissionEffect;
  rules?: PermissionPolicyRule[];
  readonlyMode?: boolean;
  simulateMode?: boolean;
  requireReasonForAsk?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PermissionRequest {
  permissionId: string;
  runId: string;
  sessionId: string;
  subject: PermissionSubject;
  arguments: unknown;
  reason?: string;
  requestedAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionDecision {
  permissionId: string;
  effect: PermissionEffect;
  reason?: string;
  resolvedBy?: 'policy' | 'human' | 'system';
  resolvedAt: string;
  editedArguments?: unknown;
  metadata?: Record<string, unknown>;
}