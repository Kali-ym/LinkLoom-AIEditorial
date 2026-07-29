import {
  emitConsoleUnauthorized,
  readConnection,
  resolveConsoleApiUrl,
} from '../../domain/connection/consoleConnection';

export class AgentConsoleApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, options: { code: string; status: number }) {
    super(message);
    this.name = 'AgentConsoleApiError';
    this.code = options.code;
    this.status = options.status;
  }
}

/** Default client timeout for remote backend (bootstrap may override via signal). */
export const AGENT_CONSOLE_FETCH_TIMEOUT_MS = 30_000;

function mergeAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active);
  }
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export function notImplemented(feature: string): never {
  throw new AgentConsoleApiError(`${feature} is not implemented yet`, {
    code: 'NOT_IMPLEMENTED',
    status: 501,
  });
}

function resolveApiUrl(path: string): string {
  return resolveConsoleApiUrl(path);
}

function buildAuthHeaders(init?: RequestInit): HeadersInit {
  const connection = readConnection();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  if (connection?.apiKey) {
    headers.Authorization = `Bearer ${connection.apiKey}`;
  }

  if (
    init?.body &&
    !headers['Content-Type'] &&
    !(init.body instanceof FormData)
  ) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function maybeEmitUnauthorized(status: number): void {
  // Only 401 means the Interop API Key is missing/invalid.
  // Business 403s (e.g. workspace_not_configured) must not clear the session.
  if (status === 401 && readConnection()) {
    emitConsoleUnauthorized();
  }
}

export async function agentConsoleFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = AGENT_CONSOLE_FETCH_TIMEOUT_MS, signal, ...rest } = init ?? {};
  const timed = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(resolveApiUrl(path), {
      ...rest,
      headers: buildAuthHeaders(rest),
      signal: mergeAbortSignals(signal ?? undefined, timed),
    });

    if (!response.ok) {
      maybeEmitUnauthorized(response.status);
      let message = response.statusText || `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore non-JSON error bodies
      }
      throw new AgentConsoleApiError(message, {
        code: 'HTTP_ERROR',
        status: response.status,
      });
    }

    return response;
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new AgentConsoleApiError(
        `请求超时（>${Math.round(timeoutMs / 1000)}s），请检查远程 backend 延迟或网络`,
        { code: 'TIMEOUT', status: 408 },
      );
    }
    throw error;
  }
}

/** Share in-flight GET JSON by path so bootstrap parallel ports don't stampede. */
const inflightGetJson = new Map<string, Promise<unknown>>();

export async function agentConsoleGetJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const cacheKey = init?.timeoutMs ? `${path}::t${init.timeoutMs}` : path;
  const existing = inflightGetJson.get(cacheKey);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const response = await agentConsoleFetch(path, init);
      return (await response.json()) as T;
    } finally {
      inflightGetJson.delete(cacheKey);
    }
  })();

  inflightGetJson.set(cacheKey, promise);
  return promise;
}

export async function agentConsolePostJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const response = await agentConsoleFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

export async function agentConsolePostFormData<T>(path: string, body: FormData): Promise<T> {
  const response = await agentConsoleFetch(path, {
    method: 'POST',
    body,
  });
  return (await response.json()) as T;
}

export async function agentConsoleDeleteJson<T = { status: string }>(
  path: string,
): Promise<T> {
  const response = await agentConsoleFetch(path, { method: 'DELETE' });
  return (await response.json()) as T;
}

export async function agentConsoleDelete(path: string): Promise<void> {
  await agentConsoleFetch(path, { method: 'DELETE' });
}

export async function agentConsolePatchJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const response = await agentConsoleFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

export async function agentConsolePutJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const response = await agentConsoleFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

export async function agentConsoleOpenEventStream(
  path: string,
  signal?: AbortSignal,
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch(resolveApiUrl(path), {
    headers: buildAuthHeaders(),
    signal,
  });

  if (!response.ok) {
    maybeEmitUnauthorized(response.status);
    throw new AgentConsoleApiError(response.statusText || `HTTP ${response.status}`, {
      code: 'HTTP_ERROR',
      status: response.status,
    });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new AgentConsoleApiError('SSE response body is empty', {
      code: 'HTTP_ERROR',
      status: response.status,
    });
  }

  return reader;
}
