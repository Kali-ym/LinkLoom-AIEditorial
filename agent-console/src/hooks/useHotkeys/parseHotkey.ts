import { isModKey } from './keyMatchers';

const MODIFIER_PARTS = new Set(['mod', 'ctrl', 'meta', 'alt', 'shift']);

function normalizeKeyPart(part: string): string {
  const lower = part.toLowerCase();
  if (lower === 'bracketleft') return '[';
  if (lower === 'bracketright') return ']';
  if (lower === 'backslash') return '\\';
  if (lower === 'backquote') return '`';
  if (lower === 'comma') return ',';
  if (lower === 'slash') return '/';
  if (lower === 'enter') return 'enter';
  return lower;
}

function eventKeyMatches(e: KeyboardEvent, keyPart: string): boolean {
  if (keyPart === '1-9') return /^[1-9]$/.test(e.key);
  const expected = normalizeKeyPart(keyPart);
  if (expected === 'enter') return e.key === 'Enter';
  return e.key.toLowerCase() === expected || e.code.toLowerCase() === `key${expected}`;
}

/** Parse lobehub-style hotkey strings (`mod+k`, `ctrl+shift+/`, `ctrl+1-9`). */
export function buildKeyMatcher(keys: string): (e: KeyboardEvent) => boolean {
  const parts = keys
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) return () => false;

  const modifiers = parts.filter((p) => MODIFIER_PARTS.has(p));
  const mainKeys = parts.filter((p) => !MODIFIER_PARTS.has(p));
  const mainKey = mainKeys[mainKeys.length - 1];

  return (e: KeyboardEvent) => {
    const wantsMod = modifiers.includes('mod');
    const wantsCtrl = modifiers.includes('ctrl');
    const wantsMeta = modifiers.includes('meta');
    const wantsAlt = modifiers.includes('alt');
    const wantsShift = modifiers.includes('shift');

    if (wantsMod && !isModKey(e)) return false;
    if (wantsCtrl && !e.ctrlKey) return false;
    if (wantsMeta && !e.metaKey) return false;
    if (wantsAlt && !e.altKey) return false;
    if (wantsShift && !e.shiftKey) return false;

    if (!wantsMod && isModKey(e) && !wantsCtrl && !wantsMeta) return false;
    if (!wantsCtrl && e.ctrlKey && !wantsMod) return false;
    if (!wantsMeta && e.metaKey && !wantsMod) return false;
    if (!wantsAlt && e.altKey) return false;
    if (!wantsShift && e.shiftKey) return false;

    if (!mainKey) return true;
    return eventKeyMatches(e, mainKey);
  };
}
