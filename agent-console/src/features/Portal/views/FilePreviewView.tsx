import { Flexbox, HtmlPreview, Markdown, Segmented, SyntaxHighlighter } from '@lobehub/ui';
import { memo, useEffect, useMemo, useState } from 'react';

import { CircleLoading } from '../../../components/CircleLoading';
import { getFilePreviewContent } from '../../../hooks/data/usePortal';
import { inferLanguage, inferPreviewKind } from '../../../utils/fileTree';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { usePortalViewUiStore, useWorkspaceStore } from '../../../stores';
import { portalStrings } from '../portalStrings';
import { portalViewStyles } from '../portalViewStyles';

/** §C.21 FilePreview*/
export const FilePreviewView = memo(function FilePreviewView({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const portalContent = useWorkspaceStore((s) => s.portalContent);
  const tab = usePortalViewUiStore((s) => s.filePreviewTab);
  const setTab = usePortalViewUiStore((s) => s.setFilePreviewTab);
  const path = payload.path || 'studio/src/App.tsx';
  const [isLoading, setIsLoading] = useState(true);
  const fullContent = getFilePreviewContent(portalContent, path, payload.content);
  const chunkText = payload.chunkText;
  const hasChunk = Boolean(chunkText);
  const previewKind = inferPreviewKind(path);
  const language = inferLanguage(path);

  useEffect(() => {
    setIsLoading(true);
    const timer = window.setTimeout(() => setIsLoading(false), 280);
    return () => window.clearTimeout(timer);
  }, [path, payload.content]);

  const displayContent = useMemo(() => {
    if (hasChunk && tab === 'chunk') return chunkText ?? '';
    return fullContent;
  }, [chunkText, fullContent, hasChunk, tab]);

  return (
    <Flexbox
      className={portalViewStyles.bodyRoot}
      flex={1}
      gap={8}
      style={{ minHeight: 0, paddingBlock: '0 4px', paddingInline: 4, borderRadius: 4 }}
    >
      {hasChunk ? (
        <Segmented
          block
          options={[
            { label: portalStrings.filePreview.chunk, value: 'chunk' },
            { label: portalStrings.filePreview.file, value: 'file' },
          ]}
          value={tab}
          onChange={(value) => setTab(value as 'chunk' | 'file')}
        />
      ) : null}

      <Flexbox className={portalViewStyles.scrollBody} flex={1}>
        {isLoading ? (
          <CircleLoading />
        ) : previewKind === 'html' ? (
          <HtmlPreview
            actionsRender={() => null}
            copyable={false}
            downloadable={false}
            shadow={false}
            style={{ height: '100%', minHeight: 0, overflow: 'hidden', width: '100%' }}
            styles={{ content: { height: '100%' }, iframe: { height: '100%' } }}
            variant="borderless"
          >
            {displayContent}
          </HtmlPreview>
        ) : previewKind === 'markdown' ? (
          <Markdown enableHtmlPreview variant="chat">
            {displayContent}
          </Markdown>
        ) : (
          <SyntaxHighlighter language={language} variant="borderless">
            {displayContent}
          </SyntaxHighlighter>
        )}
      </Flexbox>
    </Flexbox>
  );
});
