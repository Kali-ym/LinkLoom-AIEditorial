import { Modal } from '@lobehub/ui';
import { type PropsWithChildren, memo, useState } from 'react';

import { OverlayContainerContext } from '../../../NavPanel/OverlayContainer';
import { useLayoutStore } from '../../../../stores';
import { topicSearchStrings } from '../topicSearchStrings';

/** §C.51*/
export const TopicModal = memo(function TopicModal({ children }: PropsWithChildren) {
  const open = useLayoutStore((s) => s.mobileTopicModalOpen);
  const setMobileTopicModalOpen = useLayoutStore((s) => s.setMobileTopicModalOpen);
  const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);

  return (
    <OverlayContainerContext value={overlayContainer}>
      <Modal
        allowFullscreen
        footer={null}
        open={open}
        title={topicSearchStrings.modalTitle}
        styles={{
          body: { padding: 0 },
        }}
        onCancel={() => setMobileTopicModalOpen(false)}
      >
        <div ref={setOverlayContainer} style={{ height: '100%' }}>
          {children}
        </div>
      </Modal>
    </OverlayContainerContext>
  );
});
