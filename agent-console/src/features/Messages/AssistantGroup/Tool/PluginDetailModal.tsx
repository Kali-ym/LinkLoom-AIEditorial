import { Modal, SyntaxHighlighter } from '@lobehub/ui';
import { memo, useMemo } from 'react';

/** §C.26 PluginDetailModal 子集*/
export const PluginDetailModal = memo(function PluginDetailModal({
  onClose,
  open,
  pluginId,
  schema,
}: {
  onClose: () => void;
  open: boolean;
  pluginId: string;
  schema: Record<string, unknown>;
}) {
  const schemaJson = useMemo(() => JSON.stringify(schema, null, 2), [schema]);

  return (
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      title={`技能设置 · ${pluginId}`}
      width={640}
      onCancel={onClose}
    >
      <SyntaxHighlighter language="json" variant="borderless">
        {schemaJson}
      </SyntaxHighlighter>
    </Modal>
  );
});
