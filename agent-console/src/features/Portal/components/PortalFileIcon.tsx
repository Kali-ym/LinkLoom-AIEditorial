import { FileTypeIcon } from '@lobehub/ui';
import { memo } from 'react';

export const PortalFileIcon = memo(function PortalFileIcon({ name = 'App.tsx' }: { name?: string }) {
  return <FileTypeIcon type="file" filetype={name.split('.').pop()} size={16} />;
});
