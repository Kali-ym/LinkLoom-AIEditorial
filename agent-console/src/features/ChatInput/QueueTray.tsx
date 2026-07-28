import { ActionIcon, Flexbox, Icon, Image } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { ArrowUp, ListEnd, Pencil, Trash2 } from 'lucide-react';
import { memo } from 'react';

import { AttachmentMaterialFileIcon } from '../../components/AttachmentMaterialFileIcon';
import type { QueuedFile, QueueItem } from '../../domain/types';
import { useActiveTopicStreaming, useActiveTopicMessageQueue } from '../../services/streaming/streamingScope';
import { useStreamingStore, useTopicStore } from '../../stores';
import { overlayStackStyles } from './overlayStackStyles';

const PREVIEW_SIZE = 28;

const styles = createStaticStyles(({ css, cssVar }) => ({
  item: css`
    padding-block: 6px 4px;
    padding-inline: 12px 8px;
  `,
  previews: css`
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;
  `,
  fileChip: css`
    overflow: hidden;
    display: inline-flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;

    max-width: 160px;
    height: 28px;
    padding-inline: 6px;
    border: 1px solid ${cssVar.colorFillTertiary};
    border-radius: 6px;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;
  `,
  fileChipName: css`
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  imageThumb: css`
    flex-shrink: 0;
    width: 28px !important;
    height: 28px !important;
    border: 1px solid ${cssVar.colorFillTertiary};
    border-radius: 6px;
  `,
  text: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    font-size: 13px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  icon: css`
    flex-shrink: 0;
    color: ${cssVar.colorTextDescription};
  `,
}));

const isImageFile = (file: QueuedFile) => file.mimeType.startsWith('image') && !!file.url;

function QueuedFilePreview({ file }: { file: QueuedFile }) {
  if (isImageFile(file)) {
    return (
      <Image
        alt={file.name}
        classNames={{ wrapper: styles.imageThumb }}
        objectFit="cover"
        size={PREVIEW_SIZE}
        src={file.url}
        title={file.name}
        variant="borderless"
        styles={{
          image: { height: PREVIEW_SIZE, width: PREVIEW_SIZE },
          wrapper: { height: PREVIEW_SIZE, width: PREVIEW_SIZE },
        }}
      />
    );
  }

  return (
    <Flexbox horizontal align="center" className={styles.fileChip} gap={4} title={file.name}>
      <AttachmentMaterialFileIcon filename={file.name} size={14} />
      <span className={styles.fileChipName}>{file.name}</span>
    </Flexbox>
  );
}

/** §C.13 QueueTray*/
export const QueueTray = memo(function QueueTray({
  onEditQueued,
  onSendQueued,
}: {
  onEditQueued?: (item: QueueItem) => void;
  onSendQueued?: (item: QueueItem) => void;
}) {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const queue = useActiveTopicMessageQueue();
  const isStreaming = useActiveTopicStreaming();
  const stop = useStreamingStore((s) => s.stop);
  const dequeue = useStreamingStore((s) => s.dequeue);
  const takeQueueItem = useStreamingStore((s) => s.takeQueueItem);

  if (!queue.length) return null;

  return (
    <div className={overlayStackStyles.panel} data-testid="queue-tray">
      {queue.map((item, index) => (
        <Flexbox
          key={item.id}
          horizontal
          align="center"
          className={cx(styles.item, index > 0 && overlayStackStyles.itemDivider)}
          gap={8}
        >
          <Icon className={styles.icon} icon={ListEnd} size={14} />
          {item.filesPreview?.length ? (
            <div className={styles.previews}>
              {item.filesPreview.map((file) => (
                <QueuedFilePreview file={file} key={file.id} />
              ))}
            </div>
          ) : null}
          <span className={styles.text}>{item.text}</span>
          <Flexbox horizontal align="center" gap={2}>
            <ActionIcon
              icon={ArrowUp}
              size="small"
              title="立即发送"
              onClick={() => {
                const queued = activeTopicId ? takeQueueItem(activeTopicId, item.id) : null;
                if (!queued) return;
                if (isStreaming && activeTopicId) stop(activeTopicId);
                onSendQueued?.(queued);
              }}
            />
            <ActionIcon
              icon={Pencil}
              size="small"
              title="编辑"
              onClick={() => {
                const queued = activeTopicId ? takeQueueItem(activeTopicId, item.id) : null;
                if (queued) onEditQueued?.(queued);
              }}
            />
            <ActionIcon
              icon={Trash2}
              size="small"
              title="删除"
              onClick={() => {
                if (activeTopicId) dequeue(activeTopicId, item.id);
              }}
            />
          </Flexbox>
        </Flexbox>
      ))}
    </div>
  );
});
