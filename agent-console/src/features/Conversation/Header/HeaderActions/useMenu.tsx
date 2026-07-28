import type { DropdownItem } from '@lobehub/ui';
import { Block, Flexbox, Text } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import {
  Clock3,
  Copy,
  ExternalLink,
  Hash,
  Maximize2,
  PencilLine,
  Star,
  Trash,
  Wand2,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { useAuthorInfo } from '../../../../hooks/useAuthorInfo';
import { isAgentConsolePopupRoute } from '../../../../constants/agentConsoleRoutes';
import { openAgentConsoleInPopupWindow } from '../../../../services/navigation/openAgentConsoleWindow';
import { openTopicRenameModal } from '../../../TopicModals/helpers';
import { showToast } from '../../../../services/ui/toast';
import {
  useAgentStore,
  useConfigStore,
  useLayoutStore,
  useTopicStore,
} from '../../../../stores';

interface TopicInfoHeaderProps {
  authorName: string;
  title: string;
  updatedAtLabel?: string;
}

function TopicInfoHeader({ authorName, title, updatedAtLabel }: TopicInfoHeaderProps) {
  return (
    <Block
      horizontal
      align="center"
      gap={12}
      paddingBlock={8}
      paddingInline={12}
      style={{ minWidth: 240 }}
      variant="borderless"
    >
      <Flexbox flex={1} gap={2} style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text ellipsis style={{ lineHeight: 1.4 }} weight="bold">
          {title}
        </Text>
        <Text ellipsis fontSize={12} style={{ lineHeight: 1.4 }} type="secondary">
          {updatedAtLabel ? `${authorName} · ${updatedAtLabel}` : authorName}
        </Text>
      </Flexbox>
    </Block>
  );
}

/** §C.15 / §C.24 HeaderActions menu*/
export function useHeaderMenu(): { menuHeader?: ReactNode; menuItems: DropdownItem[] } {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topic = useTopicStore((s) => s.topics.find((t) => t.id === activeTopicId));
  const autoRenameTopicTitle = useTopicStore((s) => s.autoRenameTopicTitle);
  const toggleFavorite = useTopicStore((s) => s.toggleFavorite);
  const removeTopic = useTopicStore((s) => s.removeTopic);
  const wideScreen = useLayoutStore((s) => s.wideScreen);
  const toggleWideScreen = useLayoutStore((s) => s.toggleWideScreen);
  const isCompactViewport = useLayoutStore((s) => s.isCompactViewport);
  const documentCompareDocId = useConfigStore((s) => s.documentCompareDocId);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);

  const workingDirectory = topic?.workingDirectory;
  const hasTopic = Boolean(activeTopicId && topic);
  const authorInfo = useAuthorInfo(topic?.userId);

  const menuHeader = useMemo((): ReactNode | undefined => {
    if (!hasTopic) return undefined;

    if (authorInfo?.fullName) {
      const formattedDate = topic?.updatedAt
        ? new Date(topic.updatedAt).toLocaleString(undefined, {
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '';
      return (
        <TopicInfoHeader
          authorName={authorInfo.fullName}
          title="话题信息"
          updatedAtLabel={formattedDate ? `更新于 ${formattedDate}` : undefined}
        />
      );
    }

    return (
      <Block
        horizontal
        align="center"
        gap={12}
        paddingBlock={8}
        paddingInline={12}
        style={{ minWidth: 240 }}
        variant="borderless"
      >
        <Flexbox flex={1} gap={2} style={{ minWidth: 0, overflow: 'hidden' }}>
          <Text ellipsis style={{ lineHeight: 1.4 }} weight="bold">
            {topic?.title}
          </Text>
          <Text ellipsis fontSize={12} style={{ lineHeight: 1.4 }} type="secondary">
            Agent Console · 演示
          </Text>
        </Flexbox>
      </Block>
    );
  }, [authorInfo?.fullName, hasTopic, topic?.title, topic?.updatedAt]);

  const menuItems = useMemo((): DropdownItem[] => {
    if (!hasTopic) return [];

    const items: DropdownItem[] = [
      {
        key: 'favorite',
        icon: Star,
        label: topic?.fav ? '取消收藏' : '收藏话题',
        onClick: () => toggleFavorite(activeTopicId),
      },
      {
        key: 'autoRename',
        icon: Wand2,
        label: '自动重命名',
        onClick: () => autoRenameTopicTitle(activeTopicId),
      },
      {
        key: 'rename',
        icon: PencilLine,
        label: '重命名',
        onClick: () => openTopicRenameModal(activeTopicId),
      },
    ];

    if (!isCompactViewport && workingDirectory) {
      items.push({
        key: 'copyWorkingDirectory',
        icon: Copy,
        label: '复制工作目录',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(workingDirectory);
            showToast('已复制工作目录');
          } catch {
            showToast('复制失败');
          }
        },
      });
    }

    if (!isCompactViewport && activeAgentId && !isAgentConsolePopupRoute(window.location.pathname)) {
      items.push({
        key: 'openInPopupWindow',
        icon: ExternalLink,
        label: '在新窗口打开',
        onClick: () =>
          openAgentConsoleInPopupWindow({
            agentId: activeAgentId,
            topicId: activeTopicId,
          }),
      });
    }

    items.push({
      key: 'copySessionId',
      icon: Hash,
      label: '复制话题 ID',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(activeTopicId);
          showToast('已复制话题 ID');
        } catch {
          showToast('复制失败');
        }
      },
    });

    if (documentCompareDocId) {
      items.push(
        { type: 'divider' },
        {
          key: 'open-document-compare',
          icon: Clock3,
          label: '文档历史对比',
          onClick: () => showToast(`打开文档对比：${documentCompareDocId}（演示）`),
        },
      );
    }

    items.push(
      { type: 'divider' },
      {
        key: 'full-width',
        icon: Maximize2,
        label: '全宽显示',
        type: 'switch',
        checked: wideScreen,
        onCheckedChange: (checked) => toggleWideScreen(checked),
      },
      { type: 'divider' },
      {
        key: 'delete',
        icon: Trash,
        label: '删除话题',
        danger: true,
        onClick: () => {
          confirmModal({
            cancelText: '取消',
            content: `确定删除话题「${topic?.title}」？此操作不可撤销。`,
            okText: '删除',
            okButtonProps: { danger: true },
            onOk: () => {
              removeTopic(activeTopicId);
              showToast('已删除话题');
            },
            title: '删除话题',
          });
        },
      },
    );

    return items;
  }, [
    activeAgentId,
    activeTopicId,
    autoRenameTopicTitle,
    documentCompareDocId,
    hasTopic,
    isCompactViewport,
    removeTopic,
    toggleFavorite,
    toggleWideScreen,
    topic?.fav,
    topic?.title,
    wideScreen,
    workingDirectory,
  ]);

  return { menuHeader, menuItems };
}
