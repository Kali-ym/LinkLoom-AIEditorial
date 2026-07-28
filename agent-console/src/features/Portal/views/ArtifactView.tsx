import { CopyButton, DownloadButton, Flexbox, Markdown, SyntaxHighlighter, Text } from '@lobehub/ui';
import { memo } from 'react';

import type { PortalViewPayload } from '../../../domain/types/portalView';
import { usePortalViewUiStore, useWorkspaceStore } from '../../../stores';
import { portalViewStyles } from '../portalViewStyles';

/** §C.21 Artifact*/
export const ArtifactView = memo(function ArtifactView({ payload }: { payload: PortalViewPayload }) {
  const portalContent = useWorkspaceStore((s) => s.portalContent);
  const mode = usePortalViewUiStore((s) => s.artifactDisplayMode);
  const title = payload.title || portalContent.artifactPreview.title;
  const description = payload.artifactDescription ?? portalContent.artifactPreview.description;
  const code = payload.artifactCode ?? portalContent.artifactCode;

  return (
    <Flexbox
      className={portalViewStyles.artifactBody}
      flex={1}
      gap={8}
      paddingInline={12}
      style={{ minHeight: 0 }}
    >
      {mode === 'preview' ? (
        <Flexbox className={portalViewStyles.scrollBody} gap={8}>
          <Flexbox horizontal align="center" gap={8} justify="flex-end">
            <CopyButton content={code} size="small" />
            <DownloadButton
              fileName={`${title || 'artifact'}.tsx`}
              content={code}
              size="small"
            />
          </Flexbox>
          <Text style={{ fontSize: 13, lineHeight: 1.6 }}>
            <strong>{title}</strong>
          </Text>
          <Text type="secondary">{description}</Text>
          <Markdown variant="chat">{description}</Markdown>
        </Flexbox>
      ) : (
        <Flexbox className={portalViewStyles.scrollBody}>
          <SyntaxHighlighter language="tsx" style={{ fontSize: 12 }} variant="borderless">
            {code}
          </SyntaxHighlighter>
        </Flexbox>
      )}
    </Flexbox>
  );
});
