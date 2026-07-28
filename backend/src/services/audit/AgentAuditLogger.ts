import { LogService } from '../LogService.js';

export type AgentAuditAction =
  | 'permission_approved'
  | 'permission_rejected'
  | 'run_cancelled'
  | 'run_archived'
  | 'run_retried'
  | 'run_replayed';

export interface AgentAuditEntry {
  action: AgentAuditAction;
  runId: string;
  actor?: string;
  agentId?: string;
  permissionId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export class AgentAuditLogger {
  log(entry: AgentAuditEntry): void {
    try {
      LogService.info(
        `agent_audit ${JSON.stringify({
          action: entry.action,
          runId: entry.runId,
          actor: entry.actor ?? 'human',
          agentId: entry.agentId,
          permissionId: entry.permissionId,
          reason: summarize(entry.reason, 300),
          metadata: entry.metadata
        })}`
      );
    } catch (error) {
      LogService.warn(`AgentAuditLogger failed: ${(error as Error)?.message ?? error}`);
    }
  }
}

function summarize(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined;
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
