import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Archive, Star, Trash2, X } from 'lucide-react';
import { memo, useCallback } from 'react';

import { useTopicStore } from '../../stores';
import { agentTopicManagerStrings } from './agentTopicManagerStrings';
import { MoveToAgentButton } from './MoveToAgentButton';
import { useTopicsViewStore } from './store';

const styles = createStaticStyles(({ css }) => ({
  bar: css`
    pointer-events: auto;
    padding-block: 8px;
    padding-inline: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;
    background: ${cssVar.colorBgElevated};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  divider: css`
    width: 1px;
    height: 16px;
    margin-inline: 2px;
    background: ${cssVar.colorBorderSecondary};
  `,
  overlay: css`
    pointer-events: none;
    position: fixed;
    z-index: 1000;
    inset-block-end: 24px;
    inset-inline: 0;
    display: flex;
    justify-content: center;
  `,
}));

/** §C.53*/
export const BulkActionBar = memo(function BulkActionBar() {
  const selectedIds = useTopicsViewStore((s) => s.selectedIds);
  const exitSelectMode = useTopicsViewStore((s) => s.exitSelectMode);
  const toggleFavorite = useTopicStore((s) => s.toggleFavorite);
  const markTopicCompleted = useTopicStore((s) => s.markTopicCompleted);
  const removeTopic = useTopicStore((s) => s.removeTopic);

  const handleBatchFavorite = useCallback(() => {
    selectedIds.forEach((id) => toggleFavorite(id));
    exitSelectMode();
  }, [exitSelectMode, selectedIds, toggleFavorite]);

  const handleBatchArchive = useCallback(() => {
    selectedIds.forEach((id) => markTopicCompleted(id));
    exitSelectMode();
  }, [exitSelectMode, markTopicCompleted, selectedIds]);

  const handleBatchDelete = useCallback(() => {
    confirmModal({
      content: agentTopicManagerStrings.bulkDeleteConfirm(selectedIds.length),
      okButtonProps: { danger: true },
      okText: agentTopicManagerStrings.bulkDelete,
      onOk: () => {
        selectedIds.forEach((id) => removeTopic(id));
        exitSelectMode();
      },
      title: agentTopicManagerStrings.bulkDeleteTitle,
    });
  }, [exitSelectMode, removeTopic, selectedIds]);

  if (selectedIds.length === 0) return null;

  return (
    <div className={styles.overlay}>
      <Flexbox horizontal align="center" className={styles.bar} gap={4}>
        <Text style={{ marginInlineEnd: 8 }} weight={500}>
          {agentTopicManagerStrings.bulkSelected(selectedIds.length)}
        </Text>
        <ActionIcon icon={Star} size="small" title={agentTopicManagerStrings.bulkFavorite} onClick={handleBatchFavorite} />
        <ActionIcon icon={Archive} size="small" title={agentTopicManagerStrings.bulkArchive} onClick={handleBatchArchive} />
        <MoveToAgentButton />
        <ActionIcon
          icon={Trash2}
          size="small"
          style={{ color: cssVar.colorError }}
          title={agentTopicManagerStrings.bulkDelete}
          onClick={handleBatchDelete}
        />
        <span className={styles.divider} />
        <ActionIcon icon={X} size="small" title={agentTopicManagerStrings.bulkCancel} onClick={exitSelectMode} />
      </Flexbox>
    </div>
  );
});
