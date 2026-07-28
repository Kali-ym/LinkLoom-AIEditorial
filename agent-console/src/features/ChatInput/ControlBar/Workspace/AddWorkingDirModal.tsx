import { Flexbox, Input, Modal, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useCallback, useEffect, useState } from 'react';

/** §C.46*/
export const AddWorkingDirModal = memo(function AddWorkingDirModal({
  open,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  onCancel: () => void;
  onSubmit: (path: string) => Promise<string | undefined>;
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
    const next = value.trim();
    if (!next) {
      onCancel();
      return;
    }
    setLoading(true);
    try {
      const message = await onSubmit(next);
      if (message) {
        setError(message);
        return;
      }
      onCancel();
    } finally {
      setLoading(false);
    }
  }, [loading, onCancel, onSubmit, value]);

  return (
    <Modal
      maskClosable
      cancelText="取消"
      okButtonProps={{ loading }}
      okText="确认"
      open={open}
      title="添加目录"
      width="min(90vw, 480px)"
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
    >
      <Flexbox gap={16}>
        <Text type="secondary">输入远程设备上的绝对路径</Text>
        <Flexbox gap={6}>
          <Input
            autoFocus
            placeholder="/home/user/project"
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
