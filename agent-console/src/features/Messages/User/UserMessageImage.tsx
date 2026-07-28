import { memo } from 'react';

import { UserInlineImage } from './UserInlineImage';

/** User bubble image — natural height, authenticated agent-upload URLs. */
export const UserMessageImage = memo(function UserMessageImage({
  alt,
  url,
}: {
  alt?: string;
  url: string;
}) {
  return <UserInlineImage alt={alt} src={url} />;
});
