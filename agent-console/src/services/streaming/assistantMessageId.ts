/** Canonical assistant message id persisted by the backend session exporter. */
export function assistantMessageIdForRun(runId: string): string {
  return `${runId}:thread:assistant`;
}
