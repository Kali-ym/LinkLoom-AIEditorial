export function isModKey(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

export function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}
