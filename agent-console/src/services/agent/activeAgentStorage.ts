const ACTIVE_AGENT_STORAGE_KEY = 'agentConsole:activeAgentId';

export function readStoredActiveAgentId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_AGENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredActiveAgentId(agentId: string): void {
  try {
    localStorage.setItem(ACTIVE_AGENT_STORAGE_KEY, agentId);
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredActiveAgentId(): void {
  try {
    localStorage.removeItem(ACTIVE_AGENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
