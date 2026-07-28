export function matchTags(
  tags: string[] | undefined,
  includeTags: string[] | undefined,
  excludeTags: string[] | undefined
): boolean {
  const set = new Set((tags || []).map((t) => t.toLowerCase()));
  if (excludeTags?.length) {
    for (const t of excludeTags) {
      if (set.has(t.toLowerCase())) return false;
    }
  }
  if (includeTags?.length) {
    return includeTags.some((t) => set.has(t.toLowerCase()));
  }
  return true;
}

export function parseCommaList(raw?: string): string[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}
