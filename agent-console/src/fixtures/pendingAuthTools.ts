import type { PendingAuthTool } from '../domain/types/toolAuth';

/** Demo pending auth — empty by default; set in mock snapshot when testing ToolAuthAlert. */
export const DEMO_PENDING_AUTH_TOOLS: PendingAuthTool[] = [
  {
    id: 'linkloom-cloud-sandbox',
    label: 'Cloud Sandbox',
    avatar: '💻',
    authType: 'market',
  },
];
