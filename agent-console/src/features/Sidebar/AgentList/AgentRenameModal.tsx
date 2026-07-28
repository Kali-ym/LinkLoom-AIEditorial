import { Modal } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';

import { useAgentListStore } from '../../../stores/agentListStore';
import { useAgentStore } from '../../../stores';

/** §C.19 GAPS — Agent 重命名 Modal */
export const AgentRenameModal = memo(function AgentRenameModal() {
  const renamingAgentId = useAgentListStore((s) => s.renamingAgentId);
  const setRenamingAgentId = useAgentListStore((s) => s.setRenamingAgentId);
  const agents = useAgentStore((s) => s.agents);
  const renameAgent = useAgentStore((s) => s.renameAgent);
  const agent = agents.find((a) => a.id === renamingAgentId);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (agent) setValue(agent.name);
  }, [agent]);

  const close = () => setRenamingAgentId(null);

  return (
    <Modal
      cancelText="取消"
      okText="保存"
      open={Boolean(renamingAgentId && agent)}
      title="重命名 Agent"
      width={400}
      onCancel={close}
      onOk={() => {
        if (renamingAgentId && value.trim()) {
          renameAgent(renamingAgentId, value.trim());
        }
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
