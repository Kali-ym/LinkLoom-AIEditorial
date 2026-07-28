/** §C.14 — pending tool intervention surfaced in InterventionBar. */
export interface PendingIntervention {
  toolCallId: string;
  toolMessageId: string;
  assistantMessageId: string;
  apiName: string;
  identifier: string;
  requestArgs: string;
  assistantGroupId?: string;
  permissionId?: string;
  hitlKind?: string;
  hitlPrompt?: string;
  allowedActions?: string[];
  hitlSchema?: unknown;
}
