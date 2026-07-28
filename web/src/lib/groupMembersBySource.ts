import type { HotEventMember } from '@/lib/types';

export interface SourceGroup {
  /** Stable layout / selection key. */
  id: string;
  sourceLabel: string;
  role: 'primary' | 'secondary';
  /** Favicon URL from a member that has one. */
  url?: string;
  members: HotEventMember[];
  latest: HotEventMember;
}

function sourceKey(m: HotEventMember): string {
  if (m.url) {
    try {
      const host = new URL(m.url).hostname.replace(/^www\./, '').toLowerCase();
      if (host) return `host:${host}`;
    } catch {
      // fall through
    }
  }
  return `label:${m.sourceLabel.trim().toLowerCase() || 'unknown'}`;
}

/** Collapse flat event members into unique sources (一级信源). */
export function groupMembersBySource(members: HotEventMember[]): SourceGroup[] {
  const buckets = new Map<string, HotEventMember[]>();
  for (const m of members) {
    const key = sourceKey(m);
    const list = buckets.get(key) || [];
    list.push(m);
    buckets.set(key, list);
  }

  const groups: SourceGroup[] = [];
  for (const [id, list] of buckets) {
    const sorted = [...list].sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
    );
    const latest = sorted[0];
    const hasPrimary = sorted.some((m) => m.role === 'primary');
    groups.push({
      id,
      sourceLabel: latest.sourceLabel,
      role: hasPrimary ? 'primary' : 'secondary',
      url: sorted.find((m) => m.url)?.url,
      members: sorted,
      latest
    });
  }

  return groups.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'primary' ? -1 : 1;
    return Date.parse(b.latest.publishedAt) - Date.parse(a.latest.publishedAt);
  });
}
