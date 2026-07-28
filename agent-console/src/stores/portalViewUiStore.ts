import { create } from 'zustand';

export type ArtifactDisplayMode = 'preview' | 'code';
export type FilePreviewTab = 'chunk' | 'file';
export type LocalFilePreviewMode = 'render' | 'raw' | 'source';
export type ThreadCreationMode = 'continuation' | 'standalone';

interface PortalViewUiState {
  artifactDisplayMode: ArtifactDisplayMode;
  filePreviewTab: FilePreviewTab;
  localFilePreviewMode: LocalFilePreviewMode;
  activeLocalFileTab: number;
  threadCreationMode: ThreadCreationMode;
  activeThreadAgentId: string;
  setArtifactDisplayMode: (mode: ArtifactDisplayMode) => void;
  setFilePreviewTab: (tab: FilePreviewTab) => void;
  setLocalFilePreviewMode: (mode: LocalFilePreviewMode) => void;
  setActiveLocalFileTab: (index: number) => void;
  setThreadCreationMode: (mode: ThreadCreationMode) => void;
  setActiveThreadAgentId: (agentId: string) => void;
}

export const usePortalViewUiStore = create<PortalViewUiState>((set) => ({
  artifactDisplayMode: 'preview',
  filePreviewTab: 'chunk',
  localFilePreviewMode: 'render',
  activeLocalFileTab: 0,
  threadCreationMode: 'continuation',
  activeThreadAgentId: '',
  setArtifactDisplayMode: (mode) => set({ artifactDisplayMode: mode }),
  setFilePreviewTab: (tab) => set({ filePreviewTab: tab }),
  setLocalFilePreviewMode: (mode) => set({ localFilePreviewMode: mode }),
  setActiveLocalFileTab: (index) => set({ activeLocalFileTab: index }),
  setThreadCreationMode: (mode) => set({ threadCreationMode: mode }),
  setActiveThreadAgentId: (agentId) => set({ activeThreadAgentId: agentId }),
}));
