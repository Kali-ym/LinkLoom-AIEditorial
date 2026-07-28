import { toast as uiToast } from '@lobehub/ui';

/** Agent Console toast — uses LobeHub toast only (no duplicate legacy hint). */
export function showToast(message: string): void {
  uiToast.success(message);
}

export function showErrorToast(message: string): void {
  uiToast.error(message);
}
