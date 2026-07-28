/** Normalize entity / number strings for soft-merge comparison. */

/** High-frequency orgs that alone must not glue unrelated stories. */
export const GENERIC_ENTITIES = new Set([
  'openai',
  'google',
  'microsoft',
  'amazon',
  'meta',
  'facebook',
  'apple',
  'nvidia',
  'anthropic',
  'deepmind',
  'twitter',
  'xai',
  'baidu',
  'tencent',
  'alibaba',
  'bytedance',
  'samsung',
  'openaidevelopers'
]);

export function normalizeEntityToken(raw: string): string {
  let s = raw.trim().toLowerCase();
  // strip spaces and common separators so GPT-5 ≡ gpt5
  s = s.replace(/[\s\-_./]+/g, '');
  return s;
}

export function normalizeEntitySet(list: string[]): Set<string> {
  const out = new Set<string>();
  for (const e of list) {
    if (typeof e !== 'string') continue;
    const n = normalizeEntityToken(e);
    if (n) out.add(n);
  }
  return out;
}

/** Drop mega-brand tokens; empty means no specific entity signal. */
export function specificEntitySet(list: string[]): Set<string> {
  const out = new Set<string>();
  for (const e of normalizeEntitySet(list)) {
    if (!GENERIC_ENTITIES.has(e)) out.add(e);
  }
  return out;
}

export function normalizeNumberToken(raw: string): string {
  return normalizeEntityToken(raw);
}

export function normalizeNumberSet(list: string[]): Set<string> {
  return normalizeEntitySet(list);
}
