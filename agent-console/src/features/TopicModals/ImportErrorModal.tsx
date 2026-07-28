import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { createModal, type ModalInstance, useModalContext } from '@lobehub/ui/base-ui';
import { cssVar } from 'antd-style';
import { CircleX } from 'lucide-react';
import { memo } from 'react';

import { t } from '../../i18n';

const ImportErrorModalContent = memo(function ImportErrorModalContent({
  message,
}: {
  message: string;
}) {
  const { close } = useModalContext();

  return (
    <Flexbox gap={20}>
      <Text type="secondary">{message}</Text>
      <Flexbox horizontal justify="flex-end">
        <Button type="primary" onClick={close}>
          {t('topicModal.importErrorOk')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});

/** §C.52*/
export function showTopicImportError(message: string): ModalInstance {
  return createModal({
    content: <ImportErrorModalContent message={message} />,
    footer: null,
    maskClosable: true,
    styles: {
      header: { borderBottom: 'none' },
    },
    title: (
      <Flexbox horizontal align="center" gap={8}>
        <Icon color={cssVar.colorError} icon={CircleX} size={20} />
        {t('topicModal.importErrorTitle')}
      </Flexbox>
    ),
    width: 420,
  });
}
