import { AgentConsoleApiError } from '../../adapters/api/http';
import type { RunHitlResolveAction, RunHitlResolveBody } from '../../domain/types/runHitl';
import { useStreamingStore } from '../../stores/streamingStore';
import { getAgentConsolePorts } from './ports';

export type { RunHitlResolveAction } from '../../domain/types/runHitl';

export function getHttpErrorMessage(error: unknown): string {
  if (error instanceof AgentConsoleApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '操作失败';
}

export async function approveRunPermissionViaPort(
  runId: string,
  permissionId: string,
  body?: { reason?: string },
): Promise<unknown> {
  return getAgentConsolePorts().runtime.approveRunPermission(runId, permissionId, body);
}

export async function rejectRunPermissionViaPort(
  runId: string,
  permissionId: string,
  body?: { reason?: string },
): Promise<unknown> {
  return getAgentConsolePorts().runtime.rejectRunPermission(runId, permissionId, body);
}

export async function resolveRunHitlViaPort(
  runId: string,
  requestId: string,
  body: RunHitlResolveBody,
): Promise<unknown> {
  return getAgentConsolePorts().runtime.resolveRunHitl(runId, requestId, body);
}

export interface SubmitRuntimeHitlResolutionContext {
  topicId: string;
  toolCallId: string;
  permissionId?: string;
  kind?: string;
  reason?: string;
  input?: unknown;
  editedArguments?: unknown;
  externalResult?: unknown;
}

export async function submitRuntimeHitlResolution(
  action: RunHitlResolveAction,
  context: SubmitRuntimeHitlResolutionContext,
): Promise<void> {
  const runCtx = useStreamingStore.getState().getRunContextForTopic(context.topicId);
  const runId = runCtx?.runId;
  if (!runId) {
    throw new Error('无法提交：缺少运行上下文');
  }

  const permissionId = context.permissionId ?? runCtx?.permissionId;
  const hitlRequestId = runCtx?.hitlRequestId;

  if (action === 'allow' && permissionId) {
    await approveRunPermissionViaPort(runId, permissionId);
    return;
  }

  if (action === 'deny' && permissionId) {
    await rejectRunPermissionViaPort(runId, permissionId, { reason: context.reason });
    return;
  }

  if (!hitlRequestId) {
    throw new Error('无法提交 HITL：缺少 requestId');
  }

  await resolveRunHitlViaPort(runId, hitlRequestId, {
    action,
    kind: context.kind,
    reason: context.reason,
    input: context.input,
    editedArguments: context.editedArguments,
    externalResult: context.externalResult,
  });
}
