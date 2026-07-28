import { createModal, type ModalInstance } from '@lobehub/ui/base-ui';

import { topicModalStrings } from '../topicModalStrings';
import { MoveTopicsContent, type MoveTopicsContentProps } from './Content';

/** §C.52*/
export const createMoveTopicsModal = (props: MoveTopicsContentProps): ModalInstance =>
  createModal({
    content: <MoveTopicsContent {...props} />,
    footer: null,
    maskClosable: true,
    styles: {
      content: { overflow: 'hidden', padding: 0 },
    },
    title: topicModalStrings.moveTitle,
    width: 'min(90%, 420px)',
  });
