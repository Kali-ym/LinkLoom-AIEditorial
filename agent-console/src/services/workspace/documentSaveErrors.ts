import { AgentConsoleApiError } from '../../adapters/api/http';

export function isDocumentSaveConflict(error: unknown): boolean {
  return error instanceof AgentConsoleApiError && error.status === 409;
}
