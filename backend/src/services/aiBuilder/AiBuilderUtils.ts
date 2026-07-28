import path from 'path';

export function slugifyId(value: string, prefix: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return normalized || `${prefix}_${Date.now().toString(36)}`;
}

export function ensureUniqueId(baseId: string, existingIds: Set<string>): string {
  let candidate = baseId;
  let idx = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}_${idx}`;
    idx += 1;
  }
  existingIds.add(candidate);
  return candidate;
}

export { extractJsonObject } from '../../shared/json.js';

export function truncateText(value: unknown, max = 1200): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function safeRelativePath(filePath: string): string | null {
  if (!filePath || path.isAbsolute(filePath)) return null;
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../'))
    return null;
  return normalized;
}

export function deepClone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 稳定（按 key 字典序）序列化任意 JSON 兼容值，用于 HMAC 签名。
 * 与 `JSON.stringify` 的差别：对象 key 排序，避免相同语义不同顺序产生不同签名。
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}
