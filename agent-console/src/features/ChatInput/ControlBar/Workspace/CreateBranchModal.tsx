import { Flexbox, Input, Modal, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useState } from 'react';

/** §C.46*/
export const CreateBranchModal = memo(function CreateBranchModal({
  open,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<string | undefined>;
}) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setValue('');
      setError(undefined);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (loading) return;
    const name = value.trim();
    if (!name) return;
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
  }, [loading, onCancel, onSubmit, value]);

  const trimmed = value.trim();

  return (
    <Modal
      maskClosable
      cancelText="取消"
      okButtonProps={{ disabled: !trimmed, loading }}
      okText="切换分支"
      open={open}
      title="创建新分支"
      width="min(90vw, 480px)"
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
    >
      <Flexbox gap={16}>
        <Flexbox gap={6}>
          <Input
            autoFocus
            placeholder="feature/新分支名称"
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
