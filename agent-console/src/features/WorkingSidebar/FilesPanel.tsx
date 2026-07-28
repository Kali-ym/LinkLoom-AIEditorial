import {
  ActionIcon,
  ContextMenuTrigger,
  Empty,
  FileTypeIcon,
  Flexbox,
  copyToClipboard,
  type ContextMenuItem,
} from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { ChevronRight, FileIcon, RefreshCw } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

import { NeuralNetworkLoading } from '../../components/NeuralNetworkLoading';
import type { FileTreeNode } from '../../domain/types';
import { DeferEmptyState, deferStrings, isDeferApiMode, runOrDefer } from '../../features/shared';
import { countFiles } from '../../utils/fileTree';
import { showToast } from '../../services/ui/toast';
import { selectFileTreeForTopic } from '../../selectors/workspaceSelectors';
import { useTopicStore, useWorkspaceStore, useWorkingSidebarStore } from '../../stores';
import { openPortalView } from '../Portal';

const styles = createStaticStyles(({ css, cssVar: cv }) => ({
  root: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  `,
  subheader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block: 6px 8px;
    padding-inline: 14px 6px;
    border-bottom: 1px solid ${cv.colorBorderSecondary};
    background: ${cv.colorBgContainer};
  `,
  count: css`
    font-family: ${cv.fontFamilyCode};
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: ${cv.colorTextTertiary};
  `,
  tree: css`
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding: 4px 8px 8px;

    --trees-selected-bg-override: ${cv.colorFillSecondary};
    --trees-font-size-override: 12px;
    --trees-border-radius-override: 6px;
  `,
  node: css`
    cursor: pointer;
    user-select: none;

    display: flex;
    align-items: center;
    gap: 4px;

    height: 26px;
    padding-inline: 8px;
    padding-inline-start: calc(6px + var(--depth, 0) * 14px);
    border-radius: 6px;

    font-size: 12px;
    color: ${cv.colorTextSecondary};

    &:hover {
      color: ${cv.colorText};
      background: ${cv.colorFillTertiary};
    }
  `,
  nodeSelected: css`
    color: ${cv.colorText};
    background: ${cv.colorFillSecondary};
    box-shadow: inset 0 0 0 1px ${cv.colorBorderSecondary};
  `,
  chevron: css`
    flex-shrink: 0;
    color: ${cv.colorTextTertiary};
    transition: transform 0.15s;
  `,
  chevronExpanded: css`
    transform: rotate(90deg);
  `,
  chevronPlaceholder: css`
    visibility: hidden;
    flex-shrink: 0;
    width: 14px;
    height: 14px;
  `,
  name: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  gitBadge: css`
    flex-shrink: 0;
    font-family: ${cv.fontFamilyCode};
    font-size: 10px;
    font-weight: 600;
  `,
  gitModified: css`
    color: ${cv.colorWarning};
  `,
  gitAdded: css`
    color: ${cv.colorSuccess};
  `,
  gitDeleted: css`
    color: ${cv.colorError};
  `,
  loadingWrap: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  `,
}));

function FileTreeNodeRow({
  node,
  depth,
  expandedByDefault,
  selectedId,
  onSelect,
  workingDir,
  isRemote,
}: {
  node: FileTreeNode;
  depth: number;
  expandedByDefault: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  workingDir: string;
  isRemote: boolean;
}) {
  const isFolder = node.type === 'folder';
  const [expanded, setExpanded] = useState(expandedByDefault && depth < 2);
  const setTab = useWorkingSidebarStore((s) => s.setTab);
  const selected = selectedId === node.id;

  const openInPortal = useCallback(() => {
    openPortalView('FilePreview', {
      path: node.id,
      name: node.name,
      content: `// ${node.id}\n// Portal FilePreview 预览\nexport {}`,
    });
  }, [node.id, node.name]);

  const buildMenuItems = useCallback((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    if (!isFolder) {
      items.push({
        key: 'open',
        label: '打开',
        onClick: openInPortal,
      });
    }
    if (node.git) {
      items.push({
        key: 'review',
        label: '显示到审查',
        onClick: () => {
          setTab('review');
          showToast(`已定位到审查：${node.id}`);
        },
      });
    }
    items.push(
      {
        key: 'copy-abs',
        label: '复制绝对路径',
        onClick: () => {
          const abs = `${workingDir}/${node.id.replace(/^linkloom\//, '')}`;
          void copyToClipboard(abs);
          showToast(`已复制绝对路径：${abs}`);
        },
      },
      {
        key: 'copy-rel',
        label: '复制相对路径',
        onClick: () => {
          const rel = node.id.replace(/^linkloom\//, '');
          void copyToClipboard(rel);
          showToast(`已复制相对路径：${rel}`);
        },
      },
    );
    if (!isFolder && !isRemote) {
      items.push({
        key: 'reveal',
        label: '在系统中定位',
        onClick: () => runOrDefer('openInSystem', () => showToast('在系统中定位（演示）')),
      });
    }
    return items;
  }, [isFolder, isRemote, node.git, node.id, openInPortal, setTab, workingDir]);

  const handleClick = () => {
    onSelect(node.id);
    if (isFolder) {
      setExpanded((v) => !v);
      return;
    }
    openInPortal();
  };

  return (
    <div data-file-id={node.id}>
      <ContextMenuTrigger items={buildMenuItems}>
        <div
          role="treeitem"
          aria-expanded={isFolder ? expanded : undefined}
          className={cx(styles.node, selected && styles.nodeSelected)}
          style={{ ['--depth' as string]: depth }}
          onClick={handleClick}
        >
          {isFolder ? (
            <ChevronRight
              className={cx(styles.chevron, expanded && styles.chevronExpanded)}
              size={14}
            />
          ) : (
            <span className={styles.chevronPlaceholder} />
          )}
          <FileTypeIcon
            filetype={isFolder ? undefined : node.name.split('.').pop()}
            size={14}
            type={isFolder ? 'folder' : 'file'}
          />
          <span className={styles.name}>{node.name}</span>
          {node.git ? (
            <span
              className={cx(
                styles.gitBadge,
                node.git === 'M' && styles.gitModified,
                node.git === 'A' && styles.gitAdded,
                node.git === 'D' && styles.gitDeleted,
              )}
            >
              {node.git}
            </span>
          ) : null}
        </div>
      </ContextMenuTrigger>
      {isFolder && expanded && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeRow
              depth={depth + 1}
              expandedByDefault={false}
              isRemote={isRemote}
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              workingDir={workingDir}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** §C.27 Files Tab*/
export const FilesPanel = memo(function FilesPanel() {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const fileTree = useWorkspaceStore(selectFileTreeForTopic(activeTopicId));
  const workingDir = useWorkspaceStore((s) => s.workingDir);
  const filesValidating = useWorkspaceStore((s) => s.filesValidating);
  const refreshFileTree = useWorkspaceStore((s) => s.refreshFileTree);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fileCount = useMemo(() => countFiles(fileTree), [fileTree]);

  const handleRefresh = useCallback(async () => {
    if (!activeTopicId) return;
    await refreshFileTree(activeTopicId);
    showToast('文件树已刷新');
  }, [activeTopicId, refreshFileTree]);

  if (filesValidating && !fileTree.length) {
    return (
      <div className={styles.loadingWrap}>
        <NeuralNetworkLoading size={48} />
      </div>
    );
  }

  if (!fileTree.length) {
    if (isDeferApiMode()) {
      return (
        <Flexbox className={styles.root} flex={1} padding={16}>
          <DeferEmptyState
            hint={deferStrings.filesPanel.hint}
            title={deferStrings.filesPanel.title}
          />
        </Flexbox>
      );
    }
    return (
      <Flexbox align="center" className={styles.root} flex={1} justify="center" paddingBlock={24}>
        <Empty description="暂无文件" icon={FileIcon} />
      </Flexbox>
    );
  }

  return (
    <div className={styles.root} id="filesPanelMount">
      <div className={styles.subheader}>
        <span className={styles.count}>{fileCount} 个文件</span>
        <ActionIcon
          icon={RefreshCw}
          loading={filesValidating}
          size="small"
          title="刷新"
          onClick={() => void handleRefresh()}
        />
      </div>
      <div className={styles.tree} id="fileTreeRoot" role="tree">
        {fileTree.map((node) => (
          <FileTreeNodeRow
            depth={0}
            expandedByDefault
            isRemote={false}
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={setSelectedId}
            workingDir={workingDir}
          />
        ))}
      </div>
    </div>
  );
});
