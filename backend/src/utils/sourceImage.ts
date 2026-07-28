/**
 * Resolve a display avatar / source image for feed items.
 * Prefer entry-level authorAvatar, then feed.image (Folo Twitter accounts).
 */

export function pickSourceImageFromFollowEntry(entry: {
  entries?: { authorAvatar?: unknown };
  feeds?: { image?: unknown };
}): string | undefined {
  const fromAuthor = asHttpUrl(entry.entries?.authorAvatar);
  if (fromAuthor) return fromAuthor;
  return asHttpUrl(entry.feeds?.image);
}

export function readSourceImage(metadata: Record<string, unknown> | undefined | null): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  return asHttpUrl(metadata.source_image);
}

/** Fill missing `sourceImage` on hot members from an id→url map (stale snapshots). */
export function applySourceImagesToHotEvents<
  T extends { members?: Array<{ itemId: string; sourceImage?: string }> }
>(events: T[], images: Map<string, string>): T[] {
  if (images.size === 0) return events;
  let changed = false;
  const next = events.map((ev) => {
    const members = ev.members;
    if (!members?.length) return ev;
    let membersChanged = false;
    const mapped = members.map((m) => {
      if (m.sourceImage) return m;
      const img = images.get(m.itemId);
      if (!img) return m;
      membersChanged = true;
      return { ...m, sourceImage: img };
    });
    if (!membersChanged) return ev;
    changed = true;
    return { ...ev, members: mapped };
  });
  return changed ? next : events;
}

function asHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}
