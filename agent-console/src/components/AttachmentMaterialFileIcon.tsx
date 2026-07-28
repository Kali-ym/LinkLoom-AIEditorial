import { MaterialFileTypeIcon } from '@lobehub/ui';
import { memo } from 'react';

/** Material-style file type icon — shared by sent messages and pending attachments. */
export const AttachmentMaterialFileIcon = memo(function AttachmentMaterialFileIcon({
  filename,
  size,
}: {
  filename: string;
  size: number;
}) {
  return <MaterialFileTypeIcon filename={filename} size={size} type="file" variant="raw" />;
});
