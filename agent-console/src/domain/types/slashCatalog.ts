import type { ActionTagCategory } from './actionTag';

export interface SlashTriggerPosition {
  isAtLineStart: boolean;
  isMidLineAfterWhitespace: boolean;
}

export interface SlashCatalogItem {
  key: string;
  label: string;
  category: ActionTagCategory;
  type: string;
  description?: string;
}
