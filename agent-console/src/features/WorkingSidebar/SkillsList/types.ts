import type { LucideIcon } from 'lucide-react';

export interface SkillListItem {
  description?: string;
  fileCount?: number;
  files?: string[];
  id: string;
  name: string;
}

export interface SkillRowAction {
  danger?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  key: string;
  label: string;
  onClick: (item: SkillListItem) => void;
  tooltip?: string;
}
