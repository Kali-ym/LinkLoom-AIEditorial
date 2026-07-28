/** Cmd/Ctrl+click opens href in new tab*/
export function isModifierClick(e: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.metaKey || e.ctrlKey;
}
