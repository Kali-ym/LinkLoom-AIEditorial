import { isAgentConsoleApiMode } from '../../adapters/registry';
import { cancelAgentRun } from '../../adapters/api/agentRun';

let cancelInFlight: string | null = null;

/** Ask backend to cancel an in-flight agent run (fire-and-forget). */
export function requestCancelActiveAgentRun(runId: string | undefined | null): void {
  const id = runId?.trim();
  if (!id || !isAgentConsoleApiMode()) return;
  if (cancelInFlight === id) return;

  cancelInFlight = id;
  void cancelAgentRun(id)
    .catch((error) => {
      console.warn('[agentConsole] cancel agent run failed', error);
    })
    .finally(() => {
      if (cancelInFlight === id) cancelInFlight = null;
    });
}
