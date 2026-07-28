import { Icon } from '@lobehub/ui';
import type { GenericItemType } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { LucideCopy, Pen, PictureInPicture2, Pin, PinOff, Trash } from 'lucide-react';
import { useMemo } from 'react';

import { usePermission } from '../../../../hooks/usePermission';
import { useAgentListStore } from '../../../../stores/agentListStore';
import { showToast } from '../../../../services/ui/toast';

interface UseAgentGroupDropdownMenuParams {
  agentId: string;
  pinned?: boolean;
}

/** §C.34 群聊行菜单*/
export function useAgentGroupDropdownMenu({
  agentId,
  pinned,
}: UseAgentGroupDropdownMenuParams): () => GenericItemType[] {
  const { allowed: canEdit } = usePermission('edit_own_content');
  const pinAgent = useAgentListStore((s) => s.pinAgent);
  const duplicateAgent = useAgentListStore((s) => s.duplicateAgent);
  const performRemoveAgent = useAgentListStore((s) => s.performRemoveAgent);
  const setRenamingAgentId = useAgentListStore((s) => s.setRenamingAgentId);
  const openAgentInNewWindow = useAgentListStore((s) => s.openAgentInNewWindow);

  return useMemo(
    () => () =>
      [
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
          disabled: !canEdit,
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
          danger: true,
          disabled: !canEdit,
          icon: <Icon icon={Trash} />,
          key: 'delete',
          label: '删除',
          onClick: (info: { domEvent?: { stopPropagation: () => void } }) => {
            info.domEvent?.stopPropagation();
            confirmModal({
              cancelText: '取消',
              content: '确定删除该群聊？此操作不可撤销。',
              okButtonProps: { danger: true },
              okText: '删除',
              onOk: () => {
                performRemoveAgent(agentId);
                showToast('已删除群聊（演示）');
              },
              title: '删除',
            });
          },
        },
      ] satisfies GenericItemType[],
    [
      agentId,
      canEdit,
      duplicateAgent,
      openAgentInNewWindow,
      performRemoveAgent,
      pinAgent,
      pinned,
      setRenamingAgentId,
    ],
  );
}
