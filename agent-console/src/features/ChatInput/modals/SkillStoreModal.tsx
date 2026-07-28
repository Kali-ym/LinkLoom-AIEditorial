import { Flexbox, Modal, Text } from '@lobehub/ui';
import { SkillsIcon } from '@lobehub/ui/icons';
import { memo, useCallback, useMemo, useState } from 'react';

import { showToast } from '../../../services/ui/toast';
import { installSkillOnAgent } from '../../../services/skills/installSkillOnAgent';
import { listInstallableSkills } from '../../../services/skills/listInstallableSkills';
import { useAgentStore, useWorkspaceStore } from '../../../stores';

/** §C.22 — 技能商店 Modal：从目录安装技能到当前 Agent。 */
export const SkillStoreModal = memo(function SkillStoreModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const catalog = useWorkspaceStore((s) => s.skillCatalog);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const plugins = useAgentStore((s) => s.getActivePlusState().plugins);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const items = useMemo(
    () => listInstallableSkills(catalog, plugins),
    [catalog, plugins],
  );

  const handleInstall = useCallback(
    async (skillId: string, skillName: string) => {
      if (installingId) return;
      setInstallingId(skillId);
      try {
        await installSkillOnAgent(activeAgentId, skillId, skillName);
        onClose();
      } catch (error) {
        console.error('[agentConsole] install skill failed', error);
        showToast('安装技能失败，请重试');
      } finally {
        setInstallingId(null);
      }
    },
    [activeAgentId, installingId, onClose],
  );

  return (
    <Modal footer={null} open={open} title="添加技能" width={520} onCancel={onClose}>
      <Flexbox gap={12}>
        <Text type="secondary">从技能目录安装到当前 Agent。</Text>
        {items.length === 0 ? (
          <Text type="secondary">当前 Agent 已启用目录中的全部技能。</Text>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            disabled={installingId === item.id}
            type="button"
            style={{
              alignItems: 'flex-start',
              background: 'transparent',
              border: '1px solid var(--console-vars-color-border-secondary, #eee)',
              borderRadius: 10,
              cursor: installingId === item.id ? 'wait' : 'pointer',
              display: 'flex',
              gap: 10,
              opacity: installingId && installingId !== item.id ? 0.6 : 1,
              padding: '10px 12px',
              textAlign: 'left',
              width: '100%',
            }}
            onClick={() => {
              void handleInstall(item.id, item.name);
            }}
          >
            <SkillsIcon size={18} />
            <Flexbox gap={4} style={{ minWidth: 0 }}>
              <Text strong>{item.name}</Text>
              <Text type="secondary">{item.description}</Text>
            </Flexbox>
          </button>
        ))}
      </Flexbox>
    </Modal>
  );
});
