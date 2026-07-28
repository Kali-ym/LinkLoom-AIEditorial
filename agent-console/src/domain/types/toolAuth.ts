export type PendingAuthToolType = 'composio' | 'market';

export interface PendingAuthTool {
  id: string;
  label: string;
  avatar: string;
  authType: PendingAuthToolType;
}
