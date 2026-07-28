export type MenuContext = 'agent' | 'general' | 'settings';

export type PageType = 'theme' | 'ask-ai' | string;

export type ThemeMode = 'light' | 'dark' | 'system';

export interface SelectedAgent {
  backgroundColor?: string;
  id: string;
  title: string;
}

export type { CommandSearchResult } from './commandSearchTypes';
export type { ValidSearchType } from '../../domain/types/commandSearch';
