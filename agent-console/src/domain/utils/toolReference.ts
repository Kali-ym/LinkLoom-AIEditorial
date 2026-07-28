import type { ToolPayload } from '../types/tool';

export function looksLikePermissionId(id: string | undefined): boolean {
  return Boolean(id?.startsWith('perm_'));
}

/** Match a tool by LLM call id, permission id, or legacy id field. */
export function matchesToolReference(tool: ToolPayload, ref: string): boolean {
  if (!ref) return false;
  return tool.toolCallId === ref || tool.id === ref || tool.permissionId === ref;
}

/** Preferred key for patching local tool state after approval. */
export function primaryToolPatchKey(tool: ToolPayload): string | undefined {
  return tool.toolCallId ?? tool.id ?? tool.permissionId;
}

export function isPermissionPauseToolError(tool: ToolPayload): boolean {
  const errorText = `${tool.error ?? tool.resultText ?? ''}`.toLowerCase();
  return tool.state === 'error' && errorText.includes('permission required');
}

/** Tool still needs user approve/deny in InterventionBar. */
export function isToolAwaitingIntervention(tool: ToolPayload): boolean {
  if (tool.intervention?.status !== 'pending') return false;
  if (tool.state === 'success' || tool.state === 'rejected') return false;
  if (tool.state === 'error' && !isPermissionPauseToolError(tool)) return false;
  return true;
}
