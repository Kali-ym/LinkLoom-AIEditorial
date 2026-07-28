import { Icon, Popover } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { Check, Ellipsis, Pin, Trash2, Wrench, Zap } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

import { resolvePluginSettingsSchema } from '../../../../adapters/consoleDataMode';
import { usePermission } from '../../../../hooks/usePermission';
import { showToast } from '../../../../services/ui/toast';
import { useAgentStore } from '../../../../stores';
import { useWorkingSidebarStore } from '../../../../stores/workingSidebarStore';
import { useWorkspaceStore } from '../../../../stores/workspaceStore';
import { PluginDetailModal } from '../../../Messages/AssistantGroup/Tool/PluginDetailModal';
import { plusStrings } from '../../plusStrings';
import { skillPolicyStyles } from './skillPolicyStyles';

type SkillPolicyMode = 'auto' | 'pinned';

interface SkillPolicyMenuProps {
  canConfigure?: boolean;
  canUninstall?: boolean;
  displayName: string;
  id: string;
  isPinned: boolean;
}

export const SkillPolicyMenu = memo(function SkillPolicyMenu({
  canConfigure = false,
  canUninstall = true,
  displayName,
  id,
  isPinned,
}: SkillPolicyMenuProps) {
  const { allowed: canEdit } = usePermission('edit_own_content');
  const setPluginPinned = useAgentStore((s) => s.setPluginPinned);
  const uninstallPlugin = useAgentStore((s) => s.uninstallPlugin);
  const openWorkingSidebar = useWorkingSidebarStore((s) => s.openWorkingSidebar);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const settingsSchema = useMemo(() => resolvePluginSettingsSchema(id), [id]);
  const hasSettingsSchema = Boolean(settingsSchema && Object.keys(settingsSchema).length > 0);
  const showConfigure = canConfigure || hasSettingsSchema;

  const mode: SkillPolicyMode = isPinned ? 'pinned' : 'auto';

  const updatePolicy = useCallback(
    (next: SkillPolicyMode) => {
      if (!canEdit) return;
      setPluginPinned(id, next === 'pinned');
      setOpen(false);
    },
    [canEdit, id, setPluginPinned],
  );

  const openConfigure = useCallback(() => {
    if (!canEdit) return;
    setOpen(false);
    if (hasSettingsSchema) {
      setSettingsOpen(true);
      return;
    }
    openWorkingSidebar({ tab: 'space', resourceFilter: 'skills' });
    showToast(`已打开技能面板：${displayName}`);
  }, [canEdit, displayName, hasSettingsSchema, openWorkingSidebar]);

  const renderCheck = (value: SkillPolicyMode) =>
    mode === value ? (
      <span className={skillPolicyStyles.check}>
        <Icon icon={Check} size={14} />
      </span>
    ) : (
      <span className={skillPolicyStyles.check} />
    );

  const content = (
    <div
      className={skillPolicyStyles.policyPanel}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <button
        className={skillPolicyStyles.policyItem}
        disabled={!canEdit}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          updatePolicy('pinned');
        }}
      >
        <span className={skillPolicyStyles.policyItemIcon}>
          <Icon
            className={cx(mode === 'pinned' ? skillPolicyStyles.iconPinned : skillPolicyStyles.iconDefault)}
            icon={Pin}
            size={15}
          />
        </span>
        <span className={skillPolicyStyles.policyText}>{plusStrings.policyPinned}</span>
        {renderCheck('pinned')}
      </button>
      <button
        className={skillPolicyStyles.policyItem}
        disabled={!canEdit}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          updatePolicy('auto');
        }}
      >
        <span className={skillPolicyStyles.policyItemIcon}>
          <Icon
            className={cx(mode === 'auto' ? skillPolicyStyles.iconAuto : skillPolicyStyles.iconDefault)}
            icon={Zap}
            size={15}
          />
        </span>
        <span className={skillPolicyStyles.policyText}>{plusStrings.policyAuto}</span>
        {renderCheck('auto')}
      </button>
      {(showConfigure || canUninstall) && <div className={skillPolicyStyles.deleteDivider} />}
      {showConfigure ? (
        <button
          className={skillPolicyStyles.policyItem}
          disabled={!canEdit}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openConfigure();
          }}
        >
          <span className={skillPolicyStyles.policyItemIcon}>
            <Icon icon={Wrench} size={15} />
          </span>
          <span className={skillPolicyStyles.policyText}>{plusStrings.policyConfigure}</span>
        </button>
      ) : null}
      {canUninstall ? (
        <button
          className={skillPolicyStyles.deleteButton}
          disabled={!canEdit}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!canEdit) return;
            setOpen(false);
            confirmModal({
              cancelText: '取消',
              content: `确定卸载「${displayName}」？将从当前 Agent 移除该技能。`,
              okButtonProps: { danger: true },
              okText: '卸载',
              onOk: () => uninstallPlugin(id),
              title: '卸载技能',
            });
          }}
        >
          <span className={skillPolicyStyles.policyItemIcon}>
            <Icon icon={Trash2} size={15} />
          </span>
          <span className={skillPolicyStyles.policyText}>{plusStrings.policyUninstall}</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <Popover
        arrow={false}
        content={content}
        open={open}
        placement="rightTop"
        styles={{ content: { padding: 0 } }}
        trigger="click"
        onOpenChange={setOpen}
      >
        <button
          aria-label={plusStrings.policyMenu}
          className={skillPolicyStyles.policyButton}
          disabled={!canEdit}
          type="button"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon icon={Ellipsis} size={14} />
        </button>
      </Popover>
      {hasSettingsSchema && settingsSchema ? (
        <PluginDetailModal
          open={settingsOpen}
          pluginId={id}
          schema={settingsSchema}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
});

/** 判断技能是否可配置 / 可卸载（mock 策略） */
export function getSkillPolicyFlags(
  id: string,
  catalog: ReturnType<typeof useWorkspaceStore.getState>['skillCatalog'],
): { canConfigure: boolean; canUninstall: boolean } {
  const userSkill = catalog.userSkills.find((s) => s.id === id);
  const isBuiltinTool = catalog.tools.some((t) => t.id === id && t.id.startsWith('linkloom-'));
  const isAgentBundle = catalog.agentSkills.some((s) => s.id === id);
  const isProject = catalog.projectSkills.some((s) => s.id === id);

  return {
    canConfigure:
      Boolean(userSkill?.source === 'user') || Boolean(resolvePluginSettingsSchema(id)),
    canUninstall: !isBuiltinTool && !isAgentBundle && !isProject,
  };
}
