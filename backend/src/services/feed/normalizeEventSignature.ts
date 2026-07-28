const HYPE = /^(今日|突发|重磅|最新)$/;

/** Normalize LLM event_signature for hard-merge clustering. */
export function normalizeEventSignature(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/[\/_\s]+/g, '-').replace(/-+/g, '-');
  const parts = s.split('-').filter((p) => p && !HYPE.test(p));
  const out = parts.join('-').replace(/^-+|-+$/g, '');
  return out || null;
}
