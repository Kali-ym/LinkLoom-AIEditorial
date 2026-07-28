import { ToolRegistry } from '../../registries/ToolRegistry.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import {
  createPlatformPermissionPolicy,
  normalizePermissionSubject,
  previewPermissionEffect
} from './engine/PermissionEngine.js';
import type { PermissionActionKind, PermissionEffect, PermissionRiskLevel } from './engine/PermissionPolicy.js';

export interface PermissionMatrixEntry {
  toolId: string;
  toolName: string;
  scope?: string;
  actionKind: PermissionActionKind;
  riskLevel: PermissionRiskLevel;
  effect: PermissionEffect;
  reason?: string;
}

export interface GovernanceStatus {
  policyVersion: string;
  toolCount: number;
  askCount: number;
  denyCount: number;
  allowCount: number;
  pendingPermissions: number;
  externalContentGuardEnabled: boolean;
  outputValidationEnabled: boolean;
  matrix: PermissionMatrixEntry[];
}

export class AgentGovernanceService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async getStatus(): Promise<GovernanceStatus> {
    const policy = createPlatformPermissionPolicy();
    const matrix = this.buildPermissionMatrix(policy);
    const pending = await this.countPendingPermissions();

    return {
      policyVersion: String(policy.metadata?.policyVersion ?? 'platform-v1'),
      toolCount: matrix.length,
      askCount: matrix.filter((item) => item.effect === 'ask').length,
      denyCount: matrix.filter((item) => item.effect === 'deny').length,
      allowCount: matrix.filter((item) => item.effect === 'allow').length,
      pendingPermissions: pending,
      externalContentGuardEnabled: true,
      outputValidationEnabled: true,
      matrix
    };
  }

  getPermissionMatrix(): PermissionMatrixEntry[] {
    return this.buildPermissionMatrix(createPlatformPermissionPolicy());
  }

  private buildPermissionMatrix(policy: ReturnType<typeof createPlatformPermissionPolicy>) {
    const tools = ToolRegistry.getInstance().getAllTools();
    return tools
      .map((tool) => {
        const subject = normalizePermissionSubject({
          toolName: tool.id || tool.name
        });
        const preview = previewPermissionEffect(policy, subject);
        return {
          toolId: tool.id,
          toolName: tool.name || tool.id,
          scope: tool.scope,
          actionKind: subject.actionKind ?? 'unknown',
          riskLevel: subject.riskLevel ?? 'medium',
          effect: preview.decision.effect,
          reason: preview.decision.reason
        };
      })
      .sort((a, b) => effectRank(a.effect) - effectRank(b.effect) || (a.toolName ?? '').localeCompare(b.toolName ?? ''));
  }

  private async countPendingPermissions(): Promise<number> {
    if (!this.context.agentService) return 0;
    const sessions = await this.context.agentService.listRunSessions();
    return sessions.filter((session) => session.pendingPermission).length;
  }
}

function effectRank(effect: PermissionEffect): number {
  if (effect === 'deny') return 0;
  if (effect === 'ask') return 1;
  return 2;
}
