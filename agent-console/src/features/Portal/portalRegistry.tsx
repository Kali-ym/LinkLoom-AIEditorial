import { type FC, type ReactNode, lazy, Suspense } from 'react';

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

const HomeView = lazy(() => import('./views/HomeView').then((m) => ({ default: m.HomeView })));
const ArtifactView = lazy(() =>
  import('./views/ArtifactView').then((m) => ({ default: m.ArtifactView })),
);
const DocumentView = lazy(() =>
  import('./views/DocumentView').then((m) => ({ default: m.DocumentView })),
);
const MessageDetailView = lazy(() =>
  import('./views/DocumentView').then((m) => ({ default: m.MessageDetailView })),
);
const NotebookView = lazy(() =>
  import('./views/NotebookView').then((m) => ({ default: m.NotebookView })),
);
const FilePreviewView = lazy(() =>
  import('./views/FilePreviewView').then((m) => ({ default: m.FilePreviewView })),
);
const LocalFileView = lazy(() =>
  import('./views/LocalFileView').then((m) => ({ default: m.LocalFileView })),
);
const ThreadView = lazy(() =>
  import('./views/ThreadViews').then((m) => ({ default: m.ThreadView })),
);
const GroupThreadView = lazy(() =>
  import('./views/ThreadViews').then((m) => ({ default: m.GroupThreadView })),
);
const VerifyResultView = lazy(() =>
  import('./views/ThreadViews').then((m) => ({ default: m.VerifyResultView })),
);
const ToolUIView = lazy(() =>
  import('./views/ToolUIView').then((m) => ({ default: m.ToolUIView })),
);

function withSuspense(Body: FC<{ payload: PortalViewPayload }>): FC<{ payload: PortalViewPayload }> {
  return function SuspendedPortalBody({ payload }) {
    return (
      <Suspense fallback={null}>
        <Body payload={payload} />
      </Suspense>
    );
  };
}

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

/** §C.21 Portal 视图注册表 — Body 按需拆包 */
export const PORTAL_VIEW_REGISTRY: Record<PortalViewType, PortalImpl> = {
  Home: { Body: withSuspense(HomeView), Title: HomeTitle },
  Artifact: { Body: withSuspense(ArtifactView), Title: ArtifactTitle },
  Document: { Body: withSuspense(DocumentView), Title: DocumentTitle },
  Notebook: { Body: withSuspense(NotebookView), Title: NotebookTitle },
  FilePreview: { Body: withSuspense(FilePreviewView), Title: FilePreviewTitle },
  LocalFile: { Body: withSuspense(LocalFileView), Header: LocalFileHeader },
  MessageDetail: { Body: withSuspense(MessageDetailView), Title: MessageDetailTitle },
  ToolUI: { Body: withSuspense(ToolUIView), Header: ToolUIHeader },
  Thread: { Body: withSuspense(ThreadView), Header: ThreadHeader },
  GroupThread: { Body: withSuspense(GroupThreadView), Header: GroupThreadHeader },
  VerifyResult: { Body: withSuspense(VerifyResultView), Title: VerifyResultTitle },
};
