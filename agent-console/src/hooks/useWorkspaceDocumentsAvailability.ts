import { useAgentStore, useWorkspaceControlsStore } from '../stores';
import { resolveExecutionTarget } from '../features/ChatInput/ControlBar/helpers/executionTarget';

export interface WorkspaceDocumentsAvailability {
  available: boolean;
  agentId: string;
  mode?: 'local' | 'sandbox';
  reason?: 'not_sandbox' | 'sandbox_not_provisioned' | 'sandbox_status_loading';
  sandboxStatus?: string;
}

export function useWorkspaceDocumentsAvailability(): WorkspaceDocumentsAvailability {
  const agentId = useAgentStore((s) => s.activeAgentId);
  const agency = useWorkspaceControlsStore((s) => s.getAgencyConfig(agentId));
  const sandboxDto = useWorkspaceControlsStore((s) => s.sandboxStatusByAgentId[agentId]);
  const sandboxLoading = useWorkspaceControlsStore((s) => s.sandboxLoadingByAgentId[agentId]);
  const effectiveTarget = resolveExecutionTarget(agency);

  // local 模式：工作区可用，无需 sandbox status（工作区由 backend 自动创建持久化目录）。
  if (effectiveTarget === 'local') {
    return { available: true, agentId, mode: 'local' };
  }

  if (effectiveTarget !== 'sandbox') {
    return { available: false, agentId, reason: 'not_sandbox' };
  }

  if (!sandboxDto) {
    return {
      available: true,
      agentId,
      mode: 'sandbox',
      reason: sandboxLoading ? 'sandbox_status_loading' : 'sandbox_not_provisioned',
    };
  }

  if (sandboxDto.status === 'not_provisioned') {
    return { available: true, agentId, mode: 'sandbox', reason: 'sandbox_not_provisioned', sandboxStatus: sandboxDto.status };
  }

  return { available: true, agentId, mode: 'sandbox', sandboxStatus: sandboxDto.status };
}
