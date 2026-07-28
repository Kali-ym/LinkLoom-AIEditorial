import { Flexbox, Input, Modal } from '@lobehub/ui';
import { memo, useCallback, useEffect, useState } from 'react';

export const DocumentRenameModal = memo(function DocumentRenameModal({
  currentName,
  open,
  onCancel,
  onConfirm,
}: {
  currentName: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (newName: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      queueMicrotask(() => {
        const input = document.querySelector<HTMLInputElement>('[data-document-rename-input]');
        input?.focus();
        input?.select();
      });
    }
  }, [currentName, open]);

  const handleConfirm = useCallback(async () => {
    if (loading) return;
    const next = value.trim();
    if (!next || next === currentName) {
      onCancel();
      return;
    }
    setLoading(true);
    try {
      await onConfirm(next);
      onCancel();
    } finally {
      setLoading(false);
    }
  }, [currentName, loading, onCancel, onConfirm, value]);

  const trimmed = value.trim();
  const sameName = trimmed === currentName;

  return (
    <Modal
      maskClosable
      cancelText="取消"
      okButtonProps={{ disabled: !trimmed || sameName, loading }}
      okText="确定"
      open={open}
      title="重命名"
      width="min(90vw, 480px)"
      onCancel={onCancel}
      onOk={() => void handleConfirm()}
    >
      <Flexbox gap={16}>
        <Input
          data-document-rename-input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={() => void handleConfirm()}
        />
      </Flexbox>
    </Modal>
  );
});
