import { ActionIcon, Empty, Flexbox, Text } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { Globe, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

import { usePortalStore, useTopicStore, useWorkspaceStore } from '../../stores';
import { selectWebPagesForTopic } from '../../selectors/workspaceSelectors';
import { openPortalView } from '../Portal';
import { resourceStyles as styles } from './ResourcesSection/resourceStyles';

function formatRelativeTime(iso?: string): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

/** §C.27 Web Tab*/
export const WebPanel = memo(function WebPanel() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const webPages = useWorkspaceStore(selectWebPagesForTopic(activeTopicId));
  const removeWebPage = useWorkspaceStore((s) => s.removeWebPage);
  const portalStack = usePortalStore((s) => s.stack);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activePath = useMemo(() => {
    const top = portalStack[portalStack.length - 1];
    if (top?.type !== 'Document') return null;
    return (top.payload?.path as string | undefined) ?? null;
  }, [portalStack]);

  const handleOpen = useCallback((page: (typeof webPages)[number]) => {
    openPortalView('Document', { title: page.title, path: page.url });
  }, []);

  const handleDelete = useCallback(
    (page: (typeof webPages)[number], e: React.MouseEvent) => {
      e.stopPropagation();
      confirmModal({
        cancelText: '取消',
        content: `确定移除网页「${page.title}」？`,
        okButtonProps: { danger: true },
        okText: '删除',
        onOk: async () => {
          setDeletingId(page.id);
          await new Promise((resolve) => setTimeout(resolve, 200));
          removeWebPage(activeTopicId, page.id);
          setDeletingId(null);
        },
        title: '移除网页',
      });
    },
    [activeTopicId, removeWebPage],
  );

  if (!webPages.length) {
    return (
      <Flexbox align="center" flex={1} justify="center" paddingBlock={24}>
        <Empty description="暂无网页资源" icon={Globe} />
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={6} style={{ padding: 4 }}>
      {webPages.map((page) => {
        const isActive = activePath === page.url;
        const updatedLabel = formatRelativeTime(page.updatedAt);

        return (
          <Flexbox
            key={page.id}
            horizontal
            align="flex-start"
            className={cx(styles.webCard, isActive && styles.webCardActive)}
            gap={8}
            onClick={() => handleOpen(page)}
          >
            <Globe size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
              <Flexbox horizontal align="center" distribution="space-between">
                <Text className={styles.webTitle} ellipsis>
                  {page.title}
                </Text>
                <ActionIcon
                  danger
                  icon={Trash2}
                  loading={deletingId === page.id}
                  size="small"
                  title="移除"
                  onClick={(e) => handleDelete(page, e)}
                />
              </Flexbox>
              <Text className={styles.webDescription} ellipsis={{ rows: 2 }}>
                {page.url}
              </Text>
              {updatedLabel ? <Text className={styles.webMeta}>更新于 {updatedLabel}</Text> : null}
            </Flexbox>
          </Flexbox>
        );
      })}
    </Flexbox>
  );
});
