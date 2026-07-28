/** Upstream `useAppOrigin` — Web 子集；Desktop remoteServerUrl 待 Electron 壳接入。 */
export function useAppOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}
