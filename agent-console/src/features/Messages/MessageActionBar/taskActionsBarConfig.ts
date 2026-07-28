import type { MessageActionSlot } from './types';

/** §C.47*/
export const TASK_DEFAULT_BAR_WITH_TOOLS: MessageActionSlot[] = ['copy'];
export const TASK_DEFAULT_BAR: MessageActionSlot[] = ['edit', 'copy'];
export const TASK_DEFAULT_MENU: MessageActionSlot[] = [
  'edit',
  'copy',
  'collapse',
  'divider',
  'share',
  'divider',
  'regenerate',
  'del',
];
export const TASK_ERROR_BAR: MessageActionSlot[] = ['regenerate', 'del'];
export const TASK_ERROR_MENU: MessageActionSlot[] = ['edit', 'copy', 'divider', 'del'];
