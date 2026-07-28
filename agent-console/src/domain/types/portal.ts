import type { PortalViewPayload } from './portalView';

export interface PortalHomeFile {
  path: string;
  name: string;
  meta: string;
}

export interface PortalHomeArtifact {
  id: string;
  title: string;
  meta: string;
}

export interface PortalNotebookDoc {
  title: string;
  meta: string;
}

export interface PortalGroupThreadItem {
  title: string;
  meta: string;
}

export interface PortalThreadBubble {
  role: 'user' | 'assistant';
  html: string;
}

export interface PortalLocalFileTab {
  label: string;
  content: string;
  dirty?: boolean;
}

export interface PortalDocumentDefault {
  title: string;
  paragraphs: string[];
}

export interface PortalArtifactPreview {
  title: string;
  description: string;
}

export interface PortalContentData {
  homeFiles: PortalHomeFile[];
  homeArtifact: PortalHomeArtifact;
  homeTool: PortalViewPayload;
  notebookDocs: PortalNotebookDoc[];
  groupThreads: PortalGroupThreadItem[];
  threadBubbles: PortalThreadBubble[];
  localFileTabs: PortalLocalFileTab[];
  artifactPreview: PortalArtifactPreview;
  artifactCode: string;
  documentDefault: PortalDocumentDefault;
  filePreviewDefault: string;
  filePreviewByPath: Record<string, string>;
}
