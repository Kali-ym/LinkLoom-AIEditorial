export function formatJson(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function parseJsonField<T = unknown>(
  raw: string,
  fallback: T,
  onError?: (message: string) => void
): T {
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    onError?.('JSON 格式不正确');
    return fallback;
  }
}
