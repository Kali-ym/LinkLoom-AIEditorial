import { Flexbox, Segmented, Skeleton } from '@lobehub/ui';
import { memo, useMemo, useState } from 'react';

import { t } from '../../i18n';
import { useLayoutStore } from '../../stores';
import { ShareDataProvider, useShareData } from './ShareDataProvider';
import { ShareImagePanel } from './panels/ShareImagePanel';
import { ShareJsonPanel } from './panels/ShareJsonPanel';
import { SharePdfPanel } from './panels/SharePdfPanel';
import { ShareTextPanel } from './panels/ShareTextPanel';

enum ShareTab {
  JSON = 'json',
  PDF = 'pdf',
  Screenshot = 'screenshot',
  Text = 'text',
}

const ShareModalBody = memo(function ShareModalBody() {
  const [tab, setTab] = useState<ShareTab>(ShareTab.Screenshot);
  const isMobileViewport = useLayoutStore((s) => s.isMobileViewport);
  const { dbMessages, isLoading } = useShareData();

  const tabItems = useMemo(
    () => [
      { label: t('shareModal.tabScreenshot'), value: ShareTab.Screenshot },
      { label: t('shareModal.tabText'), value: ShareTab.Text },
      { label: t('shareModal.tabPdf'), value: ShareTab.PDF },
      { label: t('shareModal.tabJson'), value: ShareTab.JSON },
    ],
    [],
  );

  return (
    <Flexbox
      gap={isMobileViewport ? 8 : 24}
      height="100%"
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <Segmented
        block
        options={tabItems}
        style={{ width: '100%' }}
        value={tab}
        variant="filled"
        onChange={(value) => setTab(value as ShareTab)}
      />
      {isLoading && dbMessages.length === 0 ? (
        <Flexbox gap={12} paddingBlock={8}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Flexbox>
      ) : (
        <>
          {tab === ShareTab.Screenshot && <ShareImagePanel />}
          {tab === ShareTab.Text && <ShareTextPanel />}
          {tab === ShareTab.PDF && <SharePdfPanel />}
          {tab === ShareTab.JSON && <ShareJsonPanel />}
        </>
      )}
    </Flexbox>
  );
});

interface ShareModalContentProps {
  topicId: string;
}

/** §C.29*/
export const ShareModalContent = memo(function ShareModalContent({
  topicId,
}: ShareModalContentProps) {
  return (
    <ShareDataProvider topicId={topicId}>
      <ShareModalBody />
    </ShareDataProvider>
  );
});
