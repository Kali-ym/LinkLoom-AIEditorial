import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import type { ChatAttachmentRef } from '../../adapters/ports/IUploadPort';
import { ContextAttachmentItem } from '../ChatInput/ContextContainer/ContextAttachmentItem';

const styles = createStaticStyles(({ css }) => ({
  list: css`
    overflow-x: auto;
    width: 100%;
    padding: 8px 12px 0;
    scrollbar-width: thin;
  `,
}));

/** Attachment chips inside edit modal — reuses ContextContainer styling. */
export const EditMessageAttachments = memo(function EditMessageAttachments({
  attachments,
  onRemove,
}: {
  attachments: ChatAttachmentRef[];
  onRemove: (uploadId: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <Flexbox horizontal align="center" className={styles.list} gap={6} wrap="wrap">
      {attachments.map((attachment) => (
        <ContextAttachmentItem
          key={attachment.uploadId}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </Flexbox>
  );
});
