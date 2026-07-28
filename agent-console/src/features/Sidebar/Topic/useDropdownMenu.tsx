import { Icon } from '@lobehub/ui';
import type { DropdownItem } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { Check, Hash, Import, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import {
  parseTopicImportJson,
  showTopicImportError,
} from '../../../hooks/data/useTopicActions';
import { usePermission } from '../../../hooks/usePermission';
import { useTopicStore } from '../../../stores';
import { t } from '../../../i18n';

function pickTopicImportFile(onImport: (fileName: string, raw: string) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then(
      (raw) => onImport(file.name, raw),
      () => showTopicImportError(t('topicModal.importErrorReadFailed')),
    );
  };
  input.click();
}

export function useTopicActionsDropdownMenu(): DropdownItem[] {
  const topicPageSize = useTopicStore((s) => s.topicPageSize);
  const setTopicPageSize = useTopicStore((s) => s.setTopicPageSize);
  const importTopic = useTopicStore((s) => s.importTopic);
  const removeUnstarredTopics = useTopicStore((s) => s.removeUnstarredTopics);
  const removeAllSessionTopics = useTopicStore((s) => s.removeAllSessionTopics);
  const { allowed: canCreate } = usePermission('create_content');
  const { allowed: canEdit } = usePermission('edit_own_content');

  return useMemo(() => {
    const pageSizeOptions = [20, 40, 60, 100];
    return [
      {
        children: pageSizeOptions.map((size) => ({
          extra: topicPageSize === size ? String(size) : undefined,
          icon: topicPageSize === size ? <Icon icon={Check} /> : <span />,
          key: `pageSize-${size}`,
          label: `${size} 条/页`,
          onClick: () => setTopicPageSize(size),
        })),
        icon: <Icon icon={Hash} />,
        key: 'displayItems',
        label: '显示条目',
        type: 'group' as const,
      },
      { type: 'divider' as const },
      {
        disabled: !canCreate,
        icon: <Icon icon={Import} />,
        key: 'import',
        label: '导入对话',
        onClick: () =>
          pickTopicImportFile((fileName, raw) => {
            try {
              const payload = parseTopicImportJson(raw);
              importTopic(fileName, payload);
            } catch (err) {
              showTopicImportError(
                err instanceof Error ? err.message : t('topicModal.importErrorTitle'),
              );
            }
          }),
      },
      {
        disabled: !canEdit,
        icon: <Icon icon={Trash2} />,
        key: 'deleteUnstarred',
        label: '删除未收藏话题',
        onClick: () => {
          confirmModal({
            cancelText: '取消',
            content: '确定删除所有未收藏的话题吗？此操作不可撤销。',
            okButtonProps: { danger: true },
            okText: '删除',
            onOk: () => removeUnstarredTopics(),
            title: '删除未收藏话题',
          });
        },
      },
      {
        danger: true,
        disabled: !canEdit,
        icon: <Icon icon={Trash2} />,
        key: 'deleteAll',
        label: '删除全部话题',
        onClick: () => {
          confirmModal({
            cancelText: '取消',
            content: '确定删除当前助手的全部话题吗？此操作不可撤销。',
            okButtonProps: { danger: true },
            okText: '删除',
            onOk: () => removeAllSessionTopics(),
            title: '删除全部话题',
          });
        },
      },
    ];
  }, [
    canCreate,
    canEdit,
    importTopic,
    removeAllSessionTopics,
    removeUnstarredTopics,
    setTopicPageSize,
    topicPageSize,
  ]);
}
