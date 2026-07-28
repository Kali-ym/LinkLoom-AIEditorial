import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useCallback } from 'react';

import { useInputStore } from '../../../stores';
import { ContextAttachmentItem } from './ContextAttachmentItem';

const styles = createStaticStyles(({ css, cssVar }) => ({
  strip: css`
    overflow-x: auto;
    width: 100%;
    margin-block-end: 4px;
    padding: 8px 10px 6px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: transparent;
    scrollbar-width: thin;
  `,
  list: css`
    overflow-x: auto;
    width: 100%;
    scrollbar-width: thin;
  `,
}));

/** §C.4*/
export const ContextContainer = memo(function ContextContainer() {
  const chatUploadFileList = useInputStore((s) => s.chatUploadFileList);
  const removeChatUploadFile = useInputStore((s) => s.removeChatUploadFile);

  const handleRemove = useCallback(
    (uploadId: string) => {
      removeChatUploadFile(uploadId);
    },
    [removeChatUploadFile],
  );

  if (chatUploadFileList.length === 0) return null;

  return (
    <div className={styles.strip} id="contextContainer">
      <Flexbox horizontal align="center" className={styles.list} gap={6} wrap="nowrap">
        {chatUploadFileList.map((attachment) => (
          <ContextAttachmentItem
            key={attachment.uploadId}
            attachment={attachment}
            onRemove={handleRemove}
          />
        ))}
      </Flexbox>
    </div>
  );
});
