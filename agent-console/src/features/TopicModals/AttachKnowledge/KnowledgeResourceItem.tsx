import { Button, DropdownMenu, Flexbox, Icon, Text } from '@lobehub/ui';
import { FileTypeIcon } from '@lobehub/ui';
import { Info, LibraryBig, MoreVertical, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';

import { showToast } from '../../../services/ui/toast';
import { topicModalStrings } from '../topicModalStrings';

export type KnowledgeResourceType = 'file' | 'knowledgeBase';

export interface KnowledgeResourceItem {
  description?: string;
  enabled: boolean;
  id: string;
  name: string;
  type: KnowledgeResourceType;
}

interface KnowledgeResourceActionsProps {
  item: KnowledgeResourceItem;
  onAdd: () => Promise<void>;
  onRemove: () => Promise<void>;
}

const KnowledgeResourceActions = memo(function KnowledgeResourceActions({
  item,
  onAdd,
  onRemove,
}: KnowledgeResourceActionsProps) {
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    setLoading(true);
    try {
      await onAdd();
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await onRemove();
    } finally {
      setLoading(false);
    }
  };

  if (!item.enabled) {
    return (
      <Button loading={loading} type="primary" onClick={handleAdd}>
        {topicModalStrings.knowledgeAdd}
      </Button>
    );
  }

  return (
    <DropdownMenu
      placement="bottomRight"
      items={[
        {
          icon: <Icon icon={Info} />,
          key: 'detail',
          label: topicModalStrings.knowledgeDetail,
          onClick: () => showToast(`查看 ${item.name}（演示）`),
        },
        {
          danger: true,
          icon: <Icon icon={Trash2} />,
          key: 'remove',
          label: topicModalStrings.knowledgeRemove,
          onClick: handleRemove,
        },
      ]}
    >
      <Button icon={<Icon icon={MoreVertical} />} loading={loading} type="text" />
    </DropdownMenu>
  );
});

interface KnowledgeResourceRowProps {
  item: KnowledgeResourceItem;
  onAdd: () => Promise<void>;
  onRemove: () => Promise<void>;
}

/** §C.52*/
export const KnowledgeResourceRow = memo(function KnowledgeResourceRow({
  item,
  onAdd,
  onRemove,
}: KnowledgeResourceRowProps) {
  const icon =
    item.type === 'knowledgeBase' ? (
      <Icon icon={LibraryBig} size={20} />
    ) : (
      <FileTypeIcon filetype={item.name.split('.').pop()} size={20} type="file" />
    );

  return (
    <Flexbox
      horizontal
      align="center"
      gap={8}
      justify="space-between"
      paddingBlock={12}
      paddingInline={16}
    >
      <Flexbox horizontal align="center" flex={1} gap={8} style={{ minWidth: 0, overflow: 'hidden' }}>
        {icon}
        <Flexbox flex={1} gap={4} style={{ minWidth: 0, overflow: 'hidden' }}>
          <Text ellipsis style={{ fontSize: 14 }}>
            {item.name}
          </Text>
          {item.description ? (
            <Text ellipsis style={{ fontSize: 12 }} type="secondary">
              {item.description}
            </Text>
          ) : null}
        </Flexbox>
      </Flexbox>
      <KnowledgeResourceActions item={item} onAdd={onAdd} onRemove={onRemove} />
    </Flexbox>
  );
});
