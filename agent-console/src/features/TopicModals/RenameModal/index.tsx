import { Button, Flexbox, Input, Text } from '@lobehub/ui';
import { createModal, type ModalInstance, useModalContext } from '@lobehub/ui/base-ui';
import { memo, useCallback, useState, type FocusEvent } from 'react';

import { topicModalStrings } from '../topicModalStrings';

interface RenameModalContentProps {
  defaultValue: string;
  description?: string;
  onSave: (newTitle: string) => void | Promise<void>;
}

const RenameModalContent = memo<RenameModalContentProps>(function RenameModalContent({
  defaultValue,
  description,
  onSave,
}) {
  const { close } = useModalContext();
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);

  const handleInputFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  const handleSave = useCallback(async () => {
    if (loading) return;
    const next = value.trim();
    if (!next || next === defaultValue) {
      close();
      return;
    }
    setLoading(true);
    try {
      await onSave(next);
      close();
    } finally {
      setLoading(false);
    }
  }, [close, defaultValue, loading, onSave, value]);

  return (
    <Flexbox gap={20}>
      {description ? (
        <Text style={{ marginTop: -8 }} type="secondary">
          {description}
        </Text>
      ) : null}
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={handleInputFocus}
        onPressEnter={handleSave}
      />
      <Flexbox horizontal gap={8} justify="flex-end">
        <Button disabled={loading} onClick={close}>
          {topicModalStrings.cancel}
        </Button>
        <Button loading={loading} type="primary" onClick={handleSave}>
          {topicModalStrings.save}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});

export interface OpenRenameModalProps {
  defaultValue: string;
  description?: string;
  onSave: (newTitle: string) => void | Promise<void>;
  title?: string;
}

/** §C.52*/
export const openRenameModal = ({
  defaultValue,
  description,
  onSave,
  title,
}: OpenRenameModalProps): ModalInstance =>
  createModal({
    content: (
      <RenameModalContent defaultValue={defaultValue} description={description} onSave={onSave} />
    ),
    footer: null,
    maskClosable: true,
    styles: {
      header: { borderBottom: 'none' },
    },
    title: title ?? topicModalStrings.renameTitle,
    width: 'min(90vw, 480px)',
  });
