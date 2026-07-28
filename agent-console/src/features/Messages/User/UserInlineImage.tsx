import { Image } from 'antd';
import { memo } from 'react';

import { useAuthenticatedUploadSrc } from '../../../utils/authenticatedUploadSrc';

/** Markdown inline image — authenticated agent-upload URLs. */
export const UserInlineImage = memo(function UserInlineImage({
  src,
  alt,
}: {
  src?: string;
  alt?: string;
}) {
  const resolved = useAuthenticatedUploadSrc(typeof src === 'string' ? src : undefined);

  if (!src || !resolved) {
    return null;
  }

  return (
    <Image
      alt={alt ?? ''}
      src={resolved}
      style={{
        borderRadius: 8,
        display: 'block',
        height: 'auto',
        maxWidth: 200,
        width: '100%',
      }}
    />
  );
});
