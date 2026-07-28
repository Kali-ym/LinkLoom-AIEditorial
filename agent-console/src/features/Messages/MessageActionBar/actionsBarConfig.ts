import type { MessageActionSlot } from './types';

export const USER_DEFAULT_BAR: MessageActionSlot[] = ['regenerate', 'edit', 'copy'];
export const USER_DEFAULT_MENU: MessageActionSlot[] = [
  'edit',
  'copy',
  'forkTopic',
  'divider',
  'tts',
  'translate',
  'divider',
  'regenerate',
  'del',
];

export const ASSISTANT_DEFAULT_BAR: MessageActionSlot[] = ['edit', 'copy'];
export const ASSISTANT_DEFAULT_BAR_WITH_TOOLS: MessageActionSlot[] = ['delAndRegenerate', 'copy'];
export const ASSISTANT_DEFAULT_MENU: MessageActionSlot[] = [
  'edit',
  'copy',
  'forkTopic',
  'collapse',
  'divider',
  'tts',
  'translate',
  'divider',
  'share',
  'divider',
  'regenerate',
  'delAndRegenerate',
  'del',
];
export const ASSISTANT_ERROR_BAR: MessageActionSlot[] = ['regenerate', 'del'];
export const ASSISTANT_ERROR_MENU: MessageActionSlot[] = ['edit', 'copy', 'divider', 'del'];

export const GROUP_DEFAULT_BAR: MessageActionSlot[] = ['edit', 'copy'];
export const GROUP_DEFAULT_BAR_WITH_TOOLS: MessageActionSlot[] = ['delAndRegenerate', 'copy'];
export const GROUP_DEFAULT_MENU: MessageActionSlot[] = [
  'edit',
  'copy',
  'forkTopic',
  'collapse',
  'divider',
  'share',
  'divider',
  'regenerate',
  'del',
];
export const GROUP_EMPTY_BAR: MessageActionSlot[] = ['del'];
