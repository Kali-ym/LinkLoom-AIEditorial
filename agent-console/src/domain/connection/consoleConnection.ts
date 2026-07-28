export const CONNECTION_STORAGE_KEY = 'console_connection';
export const LAST_BASE_URL_STORAGE_KEY = 'console_last_base_url';
/** Legacy password-login token — cleared on connect/disconnect. */
export const LEGACY_AUTH_TOKEN_KEY = 'console_auth_token';

export type ConsoleConnection = {
  baseUrl: string;
  apiKey: string;
  connectedAt: string;
};

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    // Drop trailing slash; keep pathname if user pointed at a subpath host (unusual).
    const path = url.pathname.replace(/\/$/, '');
    return `${url.origin}${path === '/' ? '' : path}`;
  } catch {
    return withProtocol.replace(/\/$/, '');
  }
}

export function readConnection(): ConsoleConnection | null {
  try {
    const raw = localStorage.getItem(CONNECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsoleConnection>;
    if (
      typeof parsed.baseUrl !== 'string' ||
      !parsed.baseUrl ||
      typeof parsed.apiKey !== 'string' ||
      !parsed.apiKey
    ) {
      return null;
    }
    return {
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      connectedAt:
        typeof parsed.connectedAt === 'string' ? parsed.connectedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeConnection(connection: ConsoleConnection): void {
  localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
  localStorage.setItem(LAST_BASE_URL_STORAGE_KEY, connection.baseUrl);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

export function clearConnection(): void {
  const existing = readConnection();
  if (existing?.baseUrl) {
    localStorage.setItem(LAST_BASE_URL_STORAGE_KEY, existing.baseUrl);
  }
  localStorage.removeItem(CONNECTION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

export function readLastBaseUrl(): string {
  return localStorage.getItem(LAST_BASE_URL_STORAGE_KEY) || '';
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
}

export function resolveConsoleApiUrl(path: string, baseUrl?: string): string {
  const base = (baseUrl ?? readConnection()?.baseUrl ?? '').replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export const CONSOLE_UNAUTHORIZED_EVENT = 'console:unauthorized';

export function emitConsoleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSOLE_UNAUTHORIZED_EVENT));
}

export type ConnectionProbeResult = {
  ok: true;
  instance?: { name?: string; version?: string };
};

export async function probeConsoleConnection(
  baseUrl: string,
  apiKey: string,
  init?: { signal?: AbortSignal },
): Promise<ConnectionProbeResult> {
  const url = resolveConsoleApiUrl('/api/console/connection', baseUrl);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: init?.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|CORS/i.test(message)) {
      throw new ConsoleConnectionError(
        '无法连接实例。请检查地址，以及 backend 的 CORS_ORIGINS 是否包含本 Console 站点。',
        'network',
      );
    }
    throw new ConsoleConnectionError('网络错误，请检查连接后重试', 'network');
  }

  if (response.status === 401 || response.status === 403) {
    throw new ConsoleConnectionError('API Key 无效或已被撤销', 'auth');
  }

  if (!response.ok) {
    throw new ConsoleConnectionError(
      `实例返回 HTTP ${response.status}，请确认地址指向 LinkLoom backend`,
      'http',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ConsoleConnectionError('响应不是有效的 LinkLoom 连接接口', 'invalid');
  }

  if (!body || typeof body !== 'object' || (body as { ok?: unknown }).ok !== true) {
    throw new ConsoleConnectionError('响应不是有效的 LinkLoom 连接接口', 'invalid');
  }

  const instance = (body as { instance?: { name?: string; version?: string } }).instance;
  return { ok: true, instance };
}

export class ConsoleConnectionError extends Error {
  readonly kind: 'network' | 'auth' | 'http' | 'invalid';

  constructor(message: string, kind: ConsoleConnectionError['kind']) {
    super(message);
    this.name = 'ConsoleConnectionError';
    this.kind = kind;
  }
}
