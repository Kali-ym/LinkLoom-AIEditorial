import { Flexbox, Input, Modal } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';

import { usePermission } from '../../../hooks/usePermission';
import { useAgentListStore } from '../../../stores/agentListStore';
import { showToast } from '../../../services/ui/toast';

/** §C.34*/
export const CreateGroupModal = memo(function CreateGroupModal() {
  const createGroupForAgentId = useAgentListStore((s) => s.createGroupForAgentId);
  const closeCreateGroupModal = useAgentListStore((s) => s.closeCreateGroupModal);
  const createGroupAndMoveAgent = useAgentListStore((s) => s.createGroupAndMoveAgent);
  const { allowed: canCreate } = usePermission('create_content');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (createGroupForAgentId) setInput('');
  }, [createGroupForAgentId]);

  const close = () => {
    setInput('');
    closeCreateGroupModal();
  };

  return (
    <Modal
      destroyOnHidden
      cancelText="取消"
      okButtonProps={{ disabled: !canCreate, loading }}
      okText="创建"
      open={Boolean(createGroupForAgentId)}
      title="新建分组"
      width={400}
      onCancel={close}
      onOk={async () => {
        if (!canCreate || !createGroupForAgentId) return;
        const trimmed = input.trim();
        if (!trimmed || trimmed.length > 20) {
          showToast('分组名称需 1–20 个字符');
          return;
        }
        setLoading(true);
        createGroupAndMoveAgent(createGroupForAgentId, trimmed);
        setLoading(false);
        showToast('分组已创建');
        close();
      }}
    >
      <Flexbox paddingBlock={16}>
        <Input
          autoFocus
          disabled={!canCreate}
          placeholder="输入分组名称"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </Flexbox>
    </Modal>
  );
});
