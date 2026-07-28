import { Empty, Flexbox, Text } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { BookOpen } from 'lucide-react';
import { memo } from 'react';

import type { PortalViewPayload } from '../../../domain/types/portalView';
import { useWorkspaceStore } from '../../../stores';
import { openPortalView } from '../portalActions';
import { portalViewStyles } from '../portalViewStyles';

/** §C.21 Notebook*/
export const NotebookView = memo(function NotebookView({ payload }: { payload: PortalViewPayload }) {
  const notebookDocs = useWorkspaceStore((s) => s.portalContent.notebookDocs);
  const docs = payload.notebookDocs ?? notebookDocs;
  const hasTopic = docs.length > 0;

  if (!hasTopic) {
    return (
      <Flexbox align="center" justify="center" style={{ paddingBlock: 24 }}>
        <Empty description="暂无笔记本文档" icon={<BookOpen size={32} />} />
      </Flexbox>
    );
  }

  return (
    <Flexbox className={portalViewStyles.bodyRoot} gap={8} paddingInline={12} style={{ paddingBlock: 12 }}>
      {docs.map((doc) => (
        <button
          key={doc.title}
          className={portalViewStyles.notebookItem}
          type="button"
          onClick={() => openPortalView('Document', { title: doc.title, documentId: doc.title })}
          onContextMenu={(event) => {
            event.preventDefault();
            confirmModal({
              title: '删除文档',
              content: `确定删除「${doc.title}」？`,
              okText: '删除',
              okButtonProps: { danger: true },
              onOk: () => undefined,
            });
          }}
        >
          <Text ellipsis style={{ display: 'block' }}>
            {doc.title}
          </Text>
          <Text fontSize={12} style={{ lineHeight: 1.5 }} type="secondary">
            {doc.meta}
          </Text>
        </button>
      ))}
    </Flexbox>
  );
});
