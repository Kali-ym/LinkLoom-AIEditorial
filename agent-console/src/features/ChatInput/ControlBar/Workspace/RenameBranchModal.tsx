import { Flexbox, Input, Modal, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useState } from 'react';

/** §C.46*/
export const RenameBranchModal = memo(function RenameBranchModal({
  currentName,
  open,
  onCancel,
  onSubmit,
}: {
  currentName: string;
  open: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<string | undefined>;
}) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setError(undefined);
      queueMicrotask(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-rename-branch-input]',
        );
        input?.focus();
        input?.select();
      });
    }
  }, [currentName, open]);

  const handleSubmit = useCallback(async () => {
    if (loading) return;
    const name = value.trim();
    if (!name || name === currentName) return;
    setLoading(true);
    try {
      const message = await onSubmit(name);
      if (message) {
        setError(message);
        return;
      }
      onCancel();
    } finally {
      setLoading(false);
    }
  }, [currentName, loading, onCancel, onSubmit, value]);

  const trimmed = value.trim();
  const sameName = trimmed === currentName;

  return (
    <Modal
      maskClosable
      cancelText="取消"
      okButtonProps={{ disabled: !trimmed || sameName, loading }}
      okText="重命名分支"
      open={open}
      title="重命名分支"
      width="min(90vw, 480px)"
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
    >
      <Flexbox gap={16}>
        <Flexbox gap={6}>
          <Input
            data-rename-branch-input
            placeholder="新分支名"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
            onPressEnter={() => void handleSubmit()}
          />
          {error ? (
            <Text style={{ color: cssVar.colorError, fontSize: 12 }}>{error}</Text>
          ) : null}
        </Flexbox>
      </Flexbox>
    </Modal>
  );
});
