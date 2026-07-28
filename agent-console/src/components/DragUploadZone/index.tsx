import { Center, Flexbox, Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { FileImage, FileText, FileUp, Folder } from 'lucide-react';
import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';

import { dragUploadStrings } from './dragUploadStrings';
import { useDragUploadContext } from './DragUploadProvider';
import { type DroppedFolder, useLocalDragUpload } from './useLocalDragUpload';

const BLOCK_SIZE = 48;
const ICON_SIZE = { size: 28, strokeWidth: 1.5 };

const styles = createStaticStyles(({ css }) => ({
  container: css`
    position: relative;
  `,
  content: css`
    width: 100%;
    height: 100%;
    padding: 12px;
    border: 1.5px dashed #fff;
    border-radius: ${cssVar.borderRadiusLG};
  `,
  desc: css`
    font-size: 12px;
    line-height: 18px;
    color: #fff;
  `,
  icon: css`
    border-radius: ${cssVar.borderRadiusSM};
    color: color-mix(in srgb, ${cssVar.geekblue} 95%, black);
    background: color-mix(in srgb, ${cssVar.geekblue} 38%, white);
  `,
  iconGroup: css`
    margin-block-start: -32px;
  `,
  overlay: css`
    pointer-events: none;

    position: absolute;
    z-index: 100;
    inset: 0;

    display: flex;
    align-items: center;
    justify-content: center;

    background: ${cssVar.colorBgMask};

    transition: all 0.2s ease-in-out;
  `,
  overlayContent: css`
    padding: ${cssVar.borderRadiusLG};
    border-radius: 12px;
    background: ${cssVar.geekblue};
  `,
  title: css`
    font-size: 16px;
    font-weight: bold;
    color: #fff;
  `,
}));

export interface DragUploadZoneProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  enabledFiles?: boolean;
  enableLocalFolderMention?: boolean;
  onLocalFolders?: (folders: DroppedFolder[]) => void | Promise<void>;
  onUploadFiles: (files: File[]) => void | Promise<void>;
  overlayMinHeight?: number;
  style?: CSSProperties;
}

export const DragUploadZone = memo(function DragUploadZone({
  children,
  className,
  disabled = false,
  enabledFiles = true,
  enableLocalFolderMention = false,
  onLocalFolders,
  overlayMinHeight = 160,
  onUploadFiles,
  style,
}: DragUploadZoneProps) {
  const { isDraggingGlobally, dragContentKind } = useDragUploadContext();

  const { getContainerProps } = useLocalDragUpload({
    disabled,
    enableLocalFolderMention,
    onLocalFolders,
    onUploadFiles,
  });

  const showOverlay = isDraggingGlobally && !disabled;

  const overlayCopy = useMemo(() => {
    if (enableLocalFolderMention && dragContentKind === 'folders') {
      return {
        desc: dragUploadStrings.dragFolderDesc,
        showFolderIcon: true,
        title: dragUploadStrings.dragFolderTitle,
      };
    }
    if (enableLocalFolderMention && dragContentKind === 'mixed') {
      return {
        desc: dragUploadStrings.dragMixedDesc,
        showFolderIcon: true,
        title: dragUploadStrings.dragMixedTitle,
      };
    }
    return {
      desc: enabledFiles ? dragUploadStrings.dragFileDesc : dragUploadStrings.dragDesc,
      showFolderIcon: false,
      title: enabledFiles ? dragUploadStrings.dragFileTitle : dragUploadStrings.dragTitle,
    };
  }, [dragContentKind, enableLocalFolderMention, enabledFiles]);

  return (
    <div className={cx(styles.container, className)} style={style} {...getContainerProps()}>
      {children}
      {showOverlay ? (
        <div className={styles.overlay}>
          <div className={styles.overlayContent} style={{ minHeight: overlayMinHeight }}>
            <Center className={styles.content} gap={8}>
              <Flexbox horizontal className={styles.iconGroup}>
                <Center
                  className={styles.icon}
                  height={BLOCK_SIZE * 1.2}
                  width={BLOCK_SIZE}
                  style={{
                    background: `color-mix(in srgb, ${cssVar.geekblue} 68%, white)`,
                    transform: 'rotateZ(-20deg) translateX(8px)',
                  }}
                >
                  <Icon
                    icon={overlayCopy.showFolderIcon ? Folder : FileImage}
                    size={ICON_SIZE}
                  />
                </Center>
                <Center
                  className={styles.icon}
                  height={BLOCK_SIZE * 1.2}
                  width={BLOCK_SIZE}
                  style={{
                    transform: 'translateY(-10px)',
                    zIndex: 1,
                  }}
                >
                  <Icon icon={overlayCopy.showFolderIcon ? Folder : FileUp} size={ICON_SIZE} />
                </Center>
                <Center
                  className={styles.icon}
                  height={BLOCK_SIZE * 1.2}
                  width={BLOCK_SIZE}
                  style={{
                    background: `color-mix(in srgb, ${cssVar.geekblue} 68%, white)`,
                    transform: 'rotateZ(20deg) translateX(-8px)',
                  }}
                >
                  <Icon icon={overlayCopy.showFolderIcon ? Folder : FileText} size={ICON_SIZE} />
                </Center>
              </Flexbox>
              <Flexbox align="center" gap={4} style={{ textAlign: 'center' }}>
                <Flexbox className={styles.title}>{overlayCopy.title}</Flexbox>
                <Flexbox className={styles.desc}>{overlayCopy.desc}</Flexbox>
              </Flexbox>
            </Center>
          </div>
        </div>
      ) : null}
    </div>
  );
});

export type { DroppedFolder } from './useLocalDragUpload';
export { usePasteFile } from './usePasteFile';
export { useUploadFiles } from './useUploadFiles';
export { DragUploadProvider, useDragUploadContext } from './DragUploadProvider';
