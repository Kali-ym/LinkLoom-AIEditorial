import { Flexbox, PreviewGroup } from '@lobehub/ui';
import { memo } from 'react';

import type { MessageImageItem } from '../../../domain/types';
import { UserMessageImage } from './UserMessageImage';

const IMAGE_MAX_WIDTH = 200;

/** Upstream `ImageFileListViewer` — natural aspect ratio, no square crop box */
export const ImageFileListViewer = memo(function ImageFileListViewer({
  images,
}: {
  images: MessageImageItem[];
}) {
  if (!images?.length) return null;

  return (
    <PreviewGroup>
      <Flexbox gap={6} style={{ maxWidth: IMAGE_MAX_WIDTH, width: '100%' }}>
        {images.map((img) => (
          <UserMessageImage key={img.id} alt={img.alt} url={img.url} />
        ))}
      </Flexbox>
    </PreviewGroup>
  );
});
