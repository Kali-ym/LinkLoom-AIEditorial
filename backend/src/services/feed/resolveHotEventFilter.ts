import type { HotEvent } from '../../types/feed.js';

export function resolveHotEventFilter(
  events: HotEvent[],
  eventId: string
): {
  eventId: string;
  title: string;
  memberIds: Set<string>;
  signature: string | null;
} | null {
  const id = eventId.trim();
  if (!id) return null;
  const ev = events.find((e) => e.id === id);
  if (!ev) return null;
  let signature: string | null = null;
  if (id.startsWith('sig:')) {
    try {
      signature = decodeURIComponent(id.slice(4));
    } catch {
      signature = id.slice(4);
    }
  }
  return {
    eventId: ev.id,
    title: ev.title,
    memberIds: new Set(ev.members.map((m) => m.itemId)),
    signature
  };
}
