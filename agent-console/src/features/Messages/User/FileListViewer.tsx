import { Block, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { AttachmentMaterialFileIcon } from '../../../components/AttachmentMaterialFileIcon';
import type { MessageFileItem } from '../../../domain/types';

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Upstream `FileListViewer/Item` — outlined card with icon, name, size */
export const FileListViewer = memo(function FileListViewer({
  files,
}: {
  files: MessageFileItem[];
}) {
  if (!files?.length) return null;

  return (
    <Flexbox gap={8} style={{ maxWidth: '100%', width: 'fit-content' }}>
      {files.map((file) => (
        <Block
          key={file.id}
          clickable={Boolean(file.url)}
          horizontal
          align="center"
          gap={12}
          paddingBlock={8}
          paddingInline="12px 16px"
          variant="outlined"
          {...(file.url
            ? {
                onClick: () => window.open(file.url, '_blank', 'noopener,noreferrer'),
              }
            : {})}
        >
          <AttachmentMaterialFileIcon filename={file.name} size={32} />
          <Flexbox style={{ minWidth: 0, overflow: 'hidden' }}>
            <Text ellipsis fontSize={14}>
              {file.name}
            </Text>
            {file.size ? (
              <Text fontSize={12} type="secondary">
                {formatSize(file.size)}
              </Text>
            ) : null}
          </Flexbox>
        </Block>
      ))}
    </Flexbox>
  );
});
