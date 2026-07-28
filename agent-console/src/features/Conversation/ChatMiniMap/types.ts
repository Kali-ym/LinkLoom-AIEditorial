import type { MockMessage } from '../../../stores/types';

export const MIN_MESSAGES_THRESHOLD = 3;
export const DENSE_THRESHOLD = 16;

export interface MinimapItem {
  message: MockMessage;
  preview: string;
  width: number;
  position: number;
  el: Element | null;
}
