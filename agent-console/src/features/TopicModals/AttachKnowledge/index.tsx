import { Flexbox } from '@lobehub/ui';
import { createModal, type ModalInstance } from '@lobehub/ui/base-ui';
import { memo } from 'react';

import { useLayoutStore } from '../../../stores';
import { topicModalStrings } from '../topicModalStrings';
import { AttachKnowledgeList } from './List';

const AttachKnowledgeContent = memo(function AttachKnowledgeContent() {
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);

  return (
    <Flexbox
      gap={isMobileViewport ? 8 : 16}
      style={{ maxHeight: isMobileViewport ? '-webkit-fill-available' : 'inherit' }}
      width="100%"
    >
      <AttachKnowledgeList />
    </Flexbox>
  );
});

/** §C.52*/
export const openAttachKnowledgeModal = (): ModalInstance =>
  createModal({
    content: <AttachKnowledgeContent />,
    footer: false,
    maskClosable: true,
    styles: { content: { overflow: 'hidden' } },
    title: topicModalStrings.knowledgeTitle,
    width: 600,
  });
