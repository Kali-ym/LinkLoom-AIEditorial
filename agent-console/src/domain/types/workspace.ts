export type GitStatus = 'M' | 'A' | 'D';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  git?: GitStatus;
  children?: FileTreeNode[];
}

export interface ReviewFile {
  path: string;
  add: number;
  del: number;
  diff: string[];
}

export interface TodoItem {
  id: string;
  label: string;
  done: boolean;
  status: 'completed' | 'processing' | 'todo';
}

export interface WorkspacePlan {
  goal?: string;
  context?: string;
}

export interface DocumentNode {
  id: string;
  name: string;
  path?: string;
  badge?: string;
  children?: DocumentNode[];
}

export interface WebPage {
  id: string;
  title: string;
  url: string;
  updatedAt?: string;
}
