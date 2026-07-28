import { Icon } from '@lobehub/ui';
import type { GenericItemType } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import {
  Check,
  FolderInput,
  LucideCopy,
  LucidePlus,
  Pen,
  PictureInPicture2,
  Pin,
  PinOff,
  Trash,
} from 'lucide-react';
import { useMemo } from 'react';

import { DEFAULT_LIST_GROUP_ID } from '../../../../domain/types/agentList';
import { usePermission } from '../../../../hooks/usePermission';
import { useAgentTransferMenuItem } from '../../../../hooks/useAgentTransferMenuItem';
import { useAgentListStore } from '../../../../stores/agentListStore';

interface UseAgentDropdownMenuParams {
  agentId: string;
  pinned?: boolean;
}

/** §C.34 AgentItem 菜单*/
export function useAgentDropdownMenu({
  agentId,
  pinned,
}: UseAgentDropdownMenuParams): () => GenericItemType[] {
  const { allowed: canEdit } = usePermission('edit_own_content');
  const { allowed: canCreate } = usePermission('create_content');
  const groups = useAgentListStore((s) => s.groups);
  const groupId = useAgentListStore((s) => s.getAgentGroupId(agentId));
  const pinAgent = useAgentListStore((s) => s.pinAgent);
  const duplicateAgent = useAgentListStore((s) => s.duplicateAgent);
  const performRemoveAgent = useAgentListStore((s) => s.performRemoveAgent);
  const moveAgentToGroup = useAgentListStore((s) => s.moveAgentToGroup);
  const openCreateGroupModal = useAgentListStore((s) => s.openCreateGroupModal);
  const setRenamingAgentId = useAgentListStore((s) => s.setRenamingAgentId);
  const openAgentInNewWindow = useAgentListStore((s) => s.openAgentInNewWindow);
  const transferMenuItems = useAgentTransferMenuItem(agentId);

  const isDefault = groupId === DEFAULT_LIST_GROUP_ID;

  return useMemo(
    () => () => {
      const moveChildren: GenericItemType[] = [
        ...groups.map((g) => ({
          icon: groupId === g.id ? <Icon icon={Check} /> : <div />,
          key: g.id,
          label: g.name,
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            moveAgentToGroup(agentId, g.id);
          },
        })),
        {
          icon: isDefault ? <Icon icon={Check} /> : <div />,
          key: 'defaultList',
          label: '默认列表',
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            moveAgentToGroup(agentId, null);
          },
        },
        { type: 'divider' as const },
        {
          icon: <Icon icon={LucidePlus} />,
          key: 'createGroup',
          label: '新建分组',
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            openCreateGroupModal(agentId);
          },
        },
      ];

      return [
        {
          disabled: !canEdit,
          icon: <Icon icon={pinned ? PinOff : Pin} />,
          key: 'pin',
          label: pinned ? '取消置顶' : '置顶',
          onClick: () => pinAgent(agentId, !pinned),
        },
        {
          disabled: !canEdit,
          icon: <Icon icon={Pen} />,
          key: 'rename',
          label: '重命名',
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            setRenamingAgentId(agentId);
          },
        },
        {
          disabled: !canCreate,
          icon: <Icon icon={LucideCopy} />,
          key: 'duplicate',
          label: '复制',
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            duplicateAgent(agentId);
          },
        },
        {
          icon: <Icon icon={PictureInPicture2} />,
          key: 'openInNewWindow',
          label: '新窗口打开',
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            openAgentInNewWindow(agentId);
          },
        },
        { type: 'divider' as const },
        {
          disabled: !canEdit,
          children: moveChildren,
          icon: <Icon icon={FolderInput} />,
          key: 'moveGroup',
          label: '移动到分组',
        },
        { type: 'divider' as const },
        ...(transferMenuItems ?? []),
        ...(transferMenuItems?.length ? [{ type: 'divider' as const }] : []),
        {
          danger: true,
          disabled: !canEdit,
          icon: <Icon icon={Trash} />,
          key: 'delete',
          label: '删除',
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            confirmModal({
              cancelText: '取消',
              content: '确定删除该 Agent？此操作不可撤销。',
              okButtonProps: { danger: true },
              okText: '删除',
              onOk: () => performRemoveAgent(agentId),
              title: '删除',
            });
          },
        },
      ] satisfies GenericItemType[];
    },
    [
      agentId,
      canCreate,
      canEdit,
      duplicateAgent,
      groupId,
      groups,
      isDefault,
      moveAgentToGroup,
      openAgentInNewWindow,
      openCreateGroupModal,
      performRemoveAgent,
      pinAgent,
      pinned,
      setRenamingAgentId,
      transferMenuItems,
    ],
  );
}
