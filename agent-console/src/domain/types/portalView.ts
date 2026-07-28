export type PortalViewType =
  | 'Home'
  | 'ToolUI'
  | 'Artifact'
  | 'Document'
  | 'Notebook'
  | 'FilePreview'
  | 'LocalFile'
  | 'MessageDetail'
  | 'Thread'
  | 'GroupThread'
  | 'VerifyResult';

export interface PortalViewPayload {
  title?: string;
  content?: string;
  plugin?: string;
  api?: string;
  url?: string;
  state?: string;
  duration?: string;
  args?: Record<string, unknown>;
  result?: string;
  path?: string;
  name?: string;
  id?: string | number;
  assertion?: string;
  passed?: boolean;
  confidence?: number;
  verifier?: string;
  instruction?: string;
  bubbles?: Array<{ role: 'user' | 'assistant'; html: string }>;
  localFileTabs?: Array<{ label: string; content: string; dirty?: boolean }>;
  notebookDocs?: Array<{ title: string; meta: string }>;
  artifactDescription?: string;
  artifactId?: string;
  artifactCode?: string;
  runId?: string;
  chunkText?: string;
  documentId?: string;
  isSubagent?: boolean;
  agentName?: string;
  agentAvatar?: string;
  agentId?: string;
  threadId?: string;
  detailMarkdown?: string;
  messageId?: string;
  pending?: boolean;
  error?: string;
  toolUIParams?: import('./toolPortal').ToolUIParams;
  pluginState?: Record<string, unknown>;
  updatedAt?: number;
}

export interface PortalShowcaseEntry {
  type: PortalViewType;
  label: string;
  payload: PortalViewPayload;
}
