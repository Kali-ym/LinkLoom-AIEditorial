import { Modal } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';

import { useAgentListStore } from '../../../stores/agentListStore';

/** §C.34 GAPS — 分组重命名 Modal */
export const GroupRenameModal = memo(function GroupRenameModal() {
  const renamingGroupId = useAgentListStore((s) => s.renamingGroupId);
  const setRenamingGroupId = useAgentListStore((s) => s.setRenamingGroupId);
  const renameGroup = useAgentListStore((s) => s.renameGroup);
  const group = useAgentListStore((s) => s.groups.find((g) => g.id === renamingGroupId));
  const [value, setValue] = useState('');

  useEffect(() => {
    if (group) setValue(group.name);
  }, [group]);

  const close = () => setRenamingGroupId(null);

  return (
    <Modal
      cancelText="取消"
      okText="保存"
      open={Boolean(renamingGroupId && group)}
      title="重命名分组"
      width={400}
      onCancel={close}
      onOk={() => {
        if (renamingGroupId && value.trim()) renameGroup(renamingGroupId, value.trim());
        close();
      }}
    >
      <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>名称</label>
      <input
        type="text"
        value={value}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid var(--console-vars-color-border)',
          borderRadius: 8,
          fontSize: 14,
        }}
        onChange={(e) => setValue(e.target.value)}
      />
    </Modal>
  );
});
