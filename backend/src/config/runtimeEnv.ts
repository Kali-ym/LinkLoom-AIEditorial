/**
 * 从 .env / 进程环境解析运行时配置。
 * 常用项见根目录 `.env.example`；完整可选项见 `docs/env.md`。
 */

import fs from 'fs';

function isDockerRuntime(): boolean {
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

function urlPointsToLoopbackHost(url: string): boolean {
  return /@(localhost|127\.0\.0\.1)([:/]|$)/i.test(url);
}

function effectivePostgresHost(): string {
  const host = process.env.POSTGRES_HOST?.trim() || 'localhost';
  if (isDockerRuntime() && (host === 'localhost' || host === '127.0.0.1')) {
    return 'postgres';
  }
  if (!isDockerRuntime() && host === 'postgres') {
    return 'localhost';
  }
  return host;
}

export function getPort(): number {
  return parseInt(process.env.PORT || '3000', 10);
}

export function getListenHost(): string {
  return process.env.LISTEN_HOST?.trim() || '0.0.0.0';
}

export function getNextPort(): number {
  return parseInt(process.env.NEXT_PORT || '3100', 10);
}

/** 应用 → Postgres；未设 DATABASE_URL 时由 POSTGRES_* 拼接。 */
export function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct && !(isDockerRuntime() && urlPointsToLoopbackHost(direct))) {
    return direct;
  }

  const user = process.env.POSTGRES_USER || 'linkloom';
  const password = process.env.POSTGRES_PASSWORD || 'linkloom';
  const host = effectivePostgresHost();
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'linkloom';

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

/** 本进程内反代 Next standalone。 */
export function resolveNextUpstreamUrl(): string {
  return process.env.NEXT_UPSTREAM_URL?.trim() || `http://127.0.0.1:${getNextPort()}`;
}

/** 容器/进程内自引用（健康检查、Next 回调等）。 */
export function resolveBackendInternalUrl(): string {
  return process.env.BACKEND_INTERNAL_URL?.trim() || `http://127.0.0.1:${getPort()}`;
}
