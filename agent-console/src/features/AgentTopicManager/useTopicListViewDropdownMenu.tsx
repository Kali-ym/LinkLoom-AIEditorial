import { Icon } from '@lobehub/ui';
import type { GenericItemType } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { FolderInput, LucideCopy, PencilLine, Share2, Trash } from 'lucide-react';
import { useMemo } from 'react';

import type { TopicViewItem } from '../../domain/types/topicView';
import { useTopicStore } from '../../stores';
import { openShareModal } from '../ShareModal';
import { openTopicMoveModal, openTopicRenameModal } from '../TopicModals/helpers';

function canEditTopic(topic: Pick<TopicViewItem, 'id' | 'status'>): boolean {
  return Boolean(topic.id) && topic.status !== 'temp' && topic.status !== 'waiting';
}

/** §C.53*/
export function useTopicListViewDropdownMenu(topic: TopicViewItem) {
  const duplicateTopic = useTopicStore((s) => s.duplicateTopic);
  const removeTopic = useTopicStore((s) => s.removeTopic);
  const dropdownMenu = useMemo((): GenericItemType[] => {
    const { id, title } = topic;
    if (!id) return [];
    const canEdit = canEditTopic(topic);

    return [
      {
        disabled: !canEdit,
        icon: <Icon icon={PencilLine} />,
        key: 'rename',
        label: '重命名',
        onClick: () => openTopicRenameModal(id),
      },
      {
        disabled: !canEdit,
        icon: <Icon icon={LucideCopy} />,
        key: 'duplicate',
        label: '复制',
        onClick: () => duplicateTopic(id),
      },
      {
        disabled: !canEdit,
        icon: <Icon icon={FolderInput} />,
        key: 'moveToAgent',
        label: '移动到其他助手',
        onClick: () => openTopicMoveModal(id),
      },
      { type: 'divider' },
      {
        icon: <Icon icon={Share2} />,
        key: 'share',
        label: '分享',
        onClick: () => openShareModal(id),
      },
      { type: 'divider' },
      {
        danger: true,
        icon: <Icon icon={Trash} />,
        key: 'delete',
        label: '删除',
        onClick: () => {
          confirmModal({
            cancelText: '取消',
            content: `确定删除话题「${title}」吗？`,
            okButtonProps: { danger: true },
            okText: '删除',
            onOk: () => removeTopic(id),
            title: '删除话题',
          });
        },
      },
    ];
  }, [duplicateTopic, removeTopic, topic]);

  return { dropdownMenu };
}
