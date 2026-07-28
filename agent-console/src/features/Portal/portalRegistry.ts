import type { FC, ReactNode } from 'react';

import type { PortalViewPayload, PortalViewType } from '../../domain/types/portalView';
import {
  GroupThreadHeader,
  LocalFileHeader,
  ThreadHeader,
  ToolUIHeader,
} from './headers';
import {
  ArtifactTitle,
  DocumentTitle,
  FilePreviewTitle,
  HomeTitle,
  MessageDetailTitle,
  NotebookTitle,
  VerifyResultTitle,
} from './titles';
import { ArtifactView } from './views/ArtifactView';
import { DocumentView, MessageDetailView } from './views/DocumentView';
import { FilePreviewView } from './views/FilePreviewView';
import { HomeView } from './views/HomeView';
import { LocalFileView } from './views/LocalFileView';
import { NotebookView } from './views/NotebookView';
import { GroupThreadView, ThreadView, VerifyResultView } from './views/ThreadViews';
import { ToolUIView } from './views/ToolUIView';

export interface PortalViewContextProps {
  payload: PortalViewPayload;
  rightExtra?: ReactNode;
}

export interface PortalImpl {
  Body: FC<{ payload: PortalViewPayload }>;
  Title?: FC<{ payload: PortalViewPayload }>;
  Header?: FC<{ payload: PortalViewPayload }>;
  rightExtra?: (payload: PortalViewPayload) => ReactNode;
}

/** §C.21 Portal 视图注册表*/
export const PORTAL_VIEW_REGISTRY: Record<PortalViewType, PortalImpl> = {
  Home: { Body: HomeView, Title: HomeTitle },
  Artifact: { Body: ArtifactView, Title: ArtifactTitle },
  Document: { Body: DocumentView, Title: DocumentTitle },
  Notebook: { Body: NotebookView, Title: NotebookTitle },
  FilePreview: { Body: FilePreviewView, Title: FilePreviewTitle },
  LocalFile: { Body: LocalFileView, Header: LocalFileHeader },
  MessageDetail: { Body: MessageDetailView, Title: MessageDetailTitle },
  ToolUI: { Body: ToolUIView, Header: ToolUIHeader },
  Thread: { Body: ThreadView, Header: ThreadHeader },
  GroupThread: { Body: GroupThreadView, Header: GroupThreadHeader },
  VerifyResult: { Body: VerifyResultView, Title: VerifyResultTitle },
};
