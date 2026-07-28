import type { ActionTagCategory } from './actionTag';

export type MentionTabKey = 'recent' | 'agents' | 'topics' | 'skills' | 'tools' | 'files';

export interface SlashMenuItemData {
  kind: 'tag';
  category: ActionTagCategory;
  label: string;
  type: string;
  desc?: string;
  badge?: string;
  iconClass: 'purple' | 'green' | 'blue';
}

export interface MentionMenuItemData {
  kind: 'agent' | 'tag' | 'topic' | 'file';
  label: string;
  type: string;
  category?: ActionTagCategory;
  desc?: string;
  gradient?: string;
  path?: string;
}

export interface InputMenuData {
  mentionTopics: MentionMenuItemData[];
  mentionFiles: MentionMenuItemData[];
  mentionRecent: MentionMenuItemData[];
}
