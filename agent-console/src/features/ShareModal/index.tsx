import { createModal, type ModalInstance } from '@lobehub/ui/base-ui';

import { t } from '../../i18n';
import { ShareModalContent } from './ShareModalContent';

/** §C.52*/
export const openShareModal = (topicId: string): ModalInstance =>
  createModal({
    content: <ShareModalContent topicId={topicId} />,
    footer: null,
    maskClosable: true,
    styles: {
      content: {
        display: 'flex',
        flexDirection: 'column',
        height: 'min(80vh, 800px)',
        overflow: 'hidden',
        padding: 16,
      },
    },
    title: t('shareModal.title'),
    width: 'min(90vw, 1024px)',
  });
