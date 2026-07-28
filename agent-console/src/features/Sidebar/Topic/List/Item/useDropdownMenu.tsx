import { Icon } from '@lobehub/ui';
import type { GenericItemType } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderInput,
  Hash,
  Link2,
  LucideCopy,
  PanelTop,
  PencilLine,
  Share2,
  Star,
  Trash,
  Wand2,
} from 'lucide-react';
import { useMemo } from 'react';

import type { Topic } from '../../../../../domain/types';
import { isDeferApiMode } from '../../../../shared/deferActions';
import { buildAgentConsoleAbsoluteUrl } from '../../../../../constants/agentConsoleRoutes';
import {
  openAgentConsoleInNewTab,
  openAgentConsoleInPopupWindow,
} from '../../../../../services/navigation/openAgentConsoleWindow';
import { showToast } from '../../../../../services/ui/toast';
import { useAgentStore, useTopicStore } from '../../../../../stores';
import { openShareModal } from '../../../../ShareModal';
import { openTopicMoveModal, openTopicRenameModal } from '../../../../TopicModals/helpers';

function canEditTopic(topic: Pick<Topic, 'id' | 'status'>): boolean {
  return Boolean(topic.id) && topic.status !== 'temp' && topic.status !== 'waiting';
}

/** §C.33 TopicItem 13 项菜单*/
export function useTopicItemDropdownMenu(
  topic: Pick<Topic, 'id' | 'title' | 'status'> & { fav?: boolean },
) {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const autoRenameTopicTitle = useTopicStore((s) => s.autoRenameTopicTitle);
  const duplicateTopic = useTopicStore((s) => s.duplicateTopic);
  const markTopicCompleted = useTopicStore((s) => s.markTopicCompleted);
  const removeTopic = useTopicStore((s) => s.removeTopic);
  const toggleFavorite = useTopicStore((s) => s.toggleFavorite);
  const unmarkTopicCompleted = useTopicStore((s) => s.unmarkTopicCompleted);

  const dropdownMenu = useMemo((): GenericItemType[] => {
    const { id, title, status, fav } = topic;
    if (!id) return [];

    const canEdit = canEditTopic(topic);
    const isCompleted = status === 'completed';
    const topicUrl = buildAgentConsoleAbsoluteUrl({
      agentId: activeAgentId || undefined,
      topicId: id,
    });
    const openTopicWindowOptions = {
      agentId: activeAgentId || undefined,
      topicId: id,
    };

    return [
      {
        disabled: !canEdit,
        icon: <Icon icon={isCompleted ? Circle : CheckCircle2} />,
        key: 'markCompleted',
        label: isCompleted ? '标为进行中' : '标为已完成',
        onClick: () => {
          if (isCompleted) unmarkTopicCompleted(id);
          else markTopicCompleted(id);
        },
      },
      { type: 'divider' },
      {
        disabled: !canEdit,
        icon: <Icon icon={Star} />,
        key: 'favorite',
        label: fav ? '取消收藏' : '收藏',
        onClick: () => toggleFavorite(id),
      },
      { type: 'divider' },
      {
        disabled: !canEdit,
        icon: <Icon icon={Wand2} />,
        key: 'autoRename',
        label: '智能重命名',
        onClick: () => autoRenameTopicTitle(id),
      },
      {
        disabled: !canEdit,
        icon: <Icon icon={PencilLine} />,
        key: 'rename',
        label: '重命名',
        onClick: () => openTopicRenameModal(id),
      },
      { type: 'divider' },
      {
        icon: <Icon icon={PanelTop} />,
        key: 'openInNewTab',
        label: '在新标签页中打开',
        onClick: () => openAgentConsoleInNewTab(openTopicWindowOptions),
      },
      {
        icon: <Icon icon={ExternalLink} />,
        key: 'openInNewWindow',
        label: '打开独立窗口',
        onClick: () => openAgentConsoleInPopupWindow(openTopicWindowOptions),
      },
      { type: 'divider' },
      {
        icon: <Icon icon={Hash} />,
        key: 'copySessionId',
        label: '复制会话 ID',
        onClick: () => {
          void navigator.clipboard.writeText(id);
          showToast('已复制会话 ID');
        },
      },
      {
        icon: <Icon icon={Link2} />,
        key: 'copyLink',
        label: '复制链接',
        onClick: () => {
          void navigator.clipboard.writeText(topicUrl);
          showToast('已复制链接');
        },
      },
      {
        disabled: !canEdit,
        icon: <Icon icon={LucideCopy} />,
        key: 'duplicate',
        label: '复制',
        onClick: () => duplicateTopic(id),
      },
      {
        disabled: !canEdit || isDeferApiMode(),
        icon: <Icon icon={FolderInput} />,
        key: 'moveToAgent',
        label: '移动到其他助手',
        onClick: () => {
          if (isDeferApiMode()) {
            showToast('当前后端暂不支持跨助手移动话题');
            return;
          }
          openTopicMoveModal(id);
        },
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
  }, [
    activeAgentId,
    autoRenameTopicTitle,
    duplicateTopic,
    markTopicCompleted,
    removeTopic,
    toggleFavorite,
    topic,
    unmarkTopicCompleted,
  ]);

  return { dropdownMenu };
}
