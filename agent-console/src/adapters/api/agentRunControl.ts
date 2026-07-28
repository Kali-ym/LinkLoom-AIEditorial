import { agentConsolePostJson } from './http';

export async function approveRunPermission(
  runId: string,
  permissionId: string,
  body?: { reason?: string },
): Promise<unknown> {
  return agentConsolePostJson(
    `/api/agent-runs/${encodeURIComponent(runId)}/permissions/${encodeURIComponent(permissionId)}/approve`,
    body ?? {},
  );
}

export async function rejectRunPermission(
  runId: string,
  permissionId: string,
  body?: { reason?: string },
): Promise<unknown> {
  return agentConsolePostJson(
    `/api/agent-runs/${encodeURIComponent(runId)}/permissions/${encodeURIComponent(permissionId)}/reject`,
    body ?? {},
  );
}

export async function resolveRunHitl(
  runId: string,
  requestId: string,
  body: {
    action: 'allow' | 'deny' | 'edit_arguments' | 'provide_input' | 'external_result' | 'cancel';
    kind?: string;
    reason?: string;
    editedArguments?: unknown;
    input?: unknown;
    externalResult?: unknown;
    metadata?: Record<string, unknown>;
  },
): Promise<unknown> {
  return agentConsolePostJson(
    `/api/agent-runs/${encodeURIComponent(runId)}/hitl/${encodeURIComponent(requestId)}/resolve`,
    body,
  );
}
