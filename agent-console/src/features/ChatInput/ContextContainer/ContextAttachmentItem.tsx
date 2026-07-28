import { Flexbox, Image, Tag, Tooltip } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useCallback } from 'react';

import type { ChatAttachmentRef } from '../../../adapters/ports/IUploadPort';
import { AttachmentMaterialFileIcon } from '../../../components/AttachmentMaterialFileIcon';
import { attachmentPreviewSrc, isImageAttachment } from '../../../utils/attachmentPreview';

const THUMB_SIZE = 18;

const styles = createStaticStyles(({ css }) => ({
  icon: css`
    overflow: hidden;
    flex-shrink: 0;
    width: ${THUMB_SIZE}px;
    height: ${THUMB_SIZE}px;
    border-radius: ${cssVar.borderRadiusXS};
  `,
  name: css`
    overflow: hidden;
    max-width: 140px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  row: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
}));

function AttachmentThumb({ attachment }: { attachment: ChatAttachmentRef }) {
  const src = attachmentPreviewSrc(attachment);
  if (src && isImageAttachment(attachment)) {
    return (
      <Image
        alt={attachment.name}
        classNames={{ wrapper: styles.icon }}
        objectFit="cover"
        size={THUMB_SIZE}
        src={src}
        title={attachment.name}
        variant="borderless"
        styles={{
          image: { height: THUMB_SIZE, width: THUMB_SIZE },
          wrapper: { height: THUMB_SIZE, width: THUMB_SIZE },
        }}
      />
    );
  }

  return (
    <Flexbox horizontal align="center" className={styles.icon} justify="center">
      <AttachmentMaterialFileIcon filename={attachment.name} size={THUMB_SIZE} />
    </Flexbox>
  );
}

/** §C.4*/
export const ContextAttachmentItem = memo(function ContextAttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachmentRef;
  onRemove: (uploadId: string) => void;
}) {
  const handleClose = useCallback(() => {
    onRemove(attachment.uploadId);
  }, [attachment.uploadId, onRemove]);

  const basename =
    attachment.name.includes('/') || attachment.name.includes('\\')
      ? attachment.name.split(/[/\\]/).pop() ?? attachment.name
      : attachment.name;

  return (
    <Tag closable size="large" onClose={handleClose}>
      <Flexbox horizontal align="center" className={styles.row} gap={6}>
        <AttachmentThumb attachment={attachment} />
        <Tooltip title={attachment.name}>
          <span className={styles.name}>{basename}</span>
        </Tooltip>
      </Flexbox>
    </Tag>
  );
});
