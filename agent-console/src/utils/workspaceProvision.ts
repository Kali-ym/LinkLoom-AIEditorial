import { AgentConsoleApiError } from '../adapters/api/http';

export function isWorkspaceNotProvisionedError(error: unknown): boolean {
  if (!(error instanceof AgentConsoleApiError)) {
    return false;
  }
  if (error.status === 403) {
    return true;
  }
  if (error.status !== 404) {
    return false;
  }
  return (
    error.message === 'workspace_not_provisioned' ||
    error.message.includes('workspace_not_provisioned')
  );
}

export function workspaceMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AgentConsoleApiError) {
    if (isWorkspaceNotProvisionedError(error)) {
      return '沙箱工作区尚未就绪，请先启动沙箱';
    }
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
