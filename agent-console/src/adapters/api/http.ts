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
  if ((status === 401 || status === 403) && readConnection()) {
    emitConsoleUnauthorized();
  }
}

export async function agentConsoleFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers: buildAuthHeaders(init),
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
}

export async function agentConsoleGetJson<T>(path: string): Promise<T> {
  const response = await agentConsoleFetch(path);
  return (await response.json()) as T;
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
