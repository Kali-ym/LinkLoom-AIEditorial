import {
  ActionIcon,
  Button,
  ContextMenuTrigger,
  Empty,
  Flexbox,
  Text,
  type ContextMenuItem,
} from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { createStaticStyles, cx } from 'antd-style';
import { ChevronRight, FilePlus, FileText, FolderPlus, RefreshCw, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DocumentNode } from '../../../domain/types';
import { useWorkspaceDocumentsAvailability } from '../../../hooks/useWorkspaceDocumentsAvailability';
import {
  createWorkspaceFolder,
  createWorkspaceMarkdown,
  deleteWorkspaceEntries,
  deleteWorkspaceEntry,
  moveWorkspaceEntry,
  refreshWorkspaceDocuments,
  renameWorkspaceEntry,
} from '../../../services/workspace/documentTreeOps';
import { selectWorkspaceDocumentsForAgent } from '../../../selectors/workspaceSelectors';
import {
  useAgentStore,
  usePortalStore,
  useWorkspaceControlsStore,
  useWorkspaceStore,
} from '../../../stores';
import {
  countWorkspaceDocumentFiles,
  findDocumentNodeByPath,
  flattenVisibleDocumentPaths,
  isDescendantPath,
  isDocumentFolder,
  resolveDocumentFolderPath,
  resolveDocumentParentPath,
} from '../../../utils/documentTree';
import { showToast } from '../../../services/ui/toast';
import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';
import { openPortalView } from '../../Portal';
import { DocumentRenameModal } from './DocumentRenameModal';

const styles = createStaticStyles(({ css, cssVar: cv }) => ({
  root: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    outline: none;
  `,
  toolbar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block: 6px 8px;
    padding-inline: 12px 8px;
    border-bottom: 1px solid ${cv.colorBorderSecondary};
    background: ${cv.colorBgContainer};
  `,
  toolbarTitle: css`
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: ${cv.colorTextTertiary};
  `,
  toolbarCount: css`
    font-size: 11px;
    color: ${cv.colorTextTertiary};
  `,
  toolbarActions: css`
    display: flex;
    gap: 2px;
  `,
  tree: css`
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding: 4px;
  `,
  row: css`
    cursor: pointer;

    display: flex;
    align-items: center;
    gap: 6px;

    width: 100%;
    height: 26px;
    padding-inline: 8px;
    border: none;
    border-radius: 6px;

    font-size: 12px;
    text-align: left;
    color: ${cv.colorTextSecondary};

    background: transparent;

    &:hover {
      color: ${cv.colorText};
      background: ${cv.colorFillTertiary};
    }
  `,
  rowSelected: css`
    color: ${cv.colorText};
    background: ${cv.colorFillSecondary};
    box-shadow: inset 0 0 0 1px ${cv.colorBorderSecondary};
  `,
  rowDragOver: css`
    background: ${cv.colorPrimaryBg};
  `,
  child: css`
    padding-inline-start: 22px;
  `,
  loadingWrap: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  `,
}));

function nodePath(node: DocumentNode): string {
  return node.path ?? node.id;
}

function TreeNode({
  agentId,
  node,
  expanded,
  selectedIds,
  dragPath,
  onToggle,
  onSelectClick,
  onStartRename,
  onCreateDocument,
  onCreateFolder,
  onDragPathChange,
}: {
  agentId: string;
  node: DocumentNode;
  expanded: Record<string, boolean>;
  selectedIds: string[];
  dragPath: string | null;
  onToggle: (id: string) => void;
  onSelectClick: (node: DocumentNode, event: React.MouseEvent) => void;
  onStartRename: (node: DocumentNode) => void;
  onCreateDocument: (parentPath: string | null) => void;
  onCreateFolder: (parentPath: string | null) => void;
  onDragPathChange: (path: string | null) => void;
}) {
  const isFolder = isDocumentFolder(node);
  const isOpen = expanded[node.id];
  const path = nodePath(node);
  const selected = selectedIds.includes(path);
  const [dragOver, setDragOver] = useState(false);

  const openFile = useCallback(() => {
    onSelectClick(node, { ctrlKey: false, metaKey: false } as React.MouseEvent);
  }, [node, onSelectClick]);

  const confirmDelete = useCallback(() => {
    confirmModal({
      cancelText: '取消',
      content: `确定删除「${node.name}」？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: () => void deleteWorkspaceEntry(agentId, path),
      title: '删除',
    });
  }, [agentId, node.name, path]);

  const buildMenuItems = useCallback((): ContextMenuItem[] => {
    const parentPath = isFolder ? path : null;
    if (isFolder) {
      return [
        {
          key: 'new-doc',
          label: '新建文档',
          onClick: () => onCreateDocument(parentPath),
        },
        {
          key: 'new-folder',
          label: '新建文件夹',
          onClick: () => onCreateFolder(parentPath),
        },
        {
          key: 'rename',
          label: '重命名',
          onClick: () => onStartRename(node),
        },
        {
          key: 'delete',
          label: '删除',
          onClick: confirmDelete,
        },
      ];
    }
    return [
      {
        key: 'open',
        label: '打开',
        onClick: openFile,
      },
      {
        key: 'rename',
        label: '重命名',
        onClick: () => onStartRename(node),
      },
      {
        key: 'delete',
        label: '删除',
        onClick: confirmDelete,
      },
    ];
  }, [confirmDelete, isFolder, node, onCreateDocument, onCreateFolder, onStartRename, openFile, path]);

  const canAcceptDrop = useCallback(
    (from: string) => {
      if (!isFolder || !from || from === path) return false;
      if (resolveDocumentParentPath(from) === path) return false;
      if (isDescendantPath(from, path)) return false;
      return true;
    },
    [isFolder, path],
  );

  const handleClick = (e: React.MouseEvent) => {
    onSelectClick(node, e);
    if (e.ctrlKey || e.metaKey) return;
    if (isFolder) {
      onToggle(node.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder || !dragPath) return;
    if (!canAcceptDrop(dragPath)) return;
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!isFolder) return;
    const from = dragPath ?? e.dataTransfer.getData('text/plain');
    if (!from || !canAcceptDrop(from)) return;
    void moveWorkspaceEntry(agentId, from, path);
    onDragPathChange(null);
  };

  return (
    <div>
      <ContextMenuTrigger items={buildMenuItems}>
        <button
          type="button"
          className={cx(styles.row, selected && styles.rowSelected, dragOver && styles.rowDragOver)}
          draggable={!isFolder}
          onClick={handleClick}
          onDragEnd={() => onDragPathChange(null)}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDragStart={(e) => {
            if (isFolder) return;
            e.dataTransfer.setData('text/plain', path);
            e.dataTransfer.effectAllowed = 'move';
            onDragPathChange(path);
          }}
          onDrop={handleDrop}
        >
          {isFolder ? (
            <ChevronRight
              size={14}
              style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}
            />
          ) : (
            <FileText size={14} />
          )}
          <Text ellipsis style={{ flex: 1, minWidth: 0 }}>
            {node.name}
          </Text>
          {node.badge ? (
            <Text type="secondary" style={{ fontSize: 10, marginInlineStart: 'auto' }}>
              {node.badge}
            </Text>
          ) : null}
        </button>
      </ContextMenuTrigger>
      {isFolder && isOpen ? (
        <div className={styles.child}>
          {node.children!.map((child) => (
            <TreeNode
              agentId={agentId}
              dragPath={dragPath}
              expanded={expanded}
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              onCreateDocument={onCreateDocument}
              onCreateFolder={onCreateFolder}
              onDragPathChange={onDragPathChange}
              onSelectClick={onSelectClick}
              onStartRename={onStartRename}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** §C.27 DocumentExplorerTree */
export const DocumentsPanel = memo(function DocumentsPanel() {
  const { available, agentId, reason, mode } = useWorkspaceDocumentsAvailability();
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const documents = useWorkspaceStore(selectWorkspaceDocumentsForAgent(activeAgentId));
  const documentsValidating = useWorkspaceStore((s) => s.documentsValidating);
  const portalView = usePortalStore((s) => s.currentView());
  const panelRef = useRef<HTMLDivElement>(null);
  const selectionAnchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!agentId || !available || mode !== 'sandbox') return;
    void useWorkspaceControlsStore.getState().fetchSandboxStatus(agentId);
  }, [agentId, available, mode]);

  const fileCount = useMemo(() => countWorkspaceDocumentFiles(documents), [documents]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const primarySelectedId = selectedIds[selectedIds.length - 1] ?? null;
  const [creating, setCreating] = useState<'folder' | 'document' | null>(null);
  const [renamingNode, setRenamingNode] = useState<DocumentNode | null>(null);
  const [dragPath, setDragPath] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    if (!agentId || documentsValidating) return;
    await refreshWorkspaceDocuments(agentId);
    showToast('文档树已刷新');
  }, [agentId, documentsValidating]);

  useEffect(() => {
    if (!agentId) return;
    void refreshWorkspaceDocuments(agentId);
  }, [agentId]);

  useEffect(() => {
    if (portalView?.type === 'Document' && typeof portalView.payload?.path === 'string') {
      setSelectedIds([portalView.payload.path]);
    }
  }, [portalView]);

  const confirmDeleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    const count = selectedIds.length;
    confirmModal({
      cancelText: '取消',
      content: count === 1 ? `确定删除「${selectedIds[0]}」？` : `确定删除选中的 ${count} 项？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        const paths = [...selectedIds];
        const portalPath =
          portalView?.type === 'Document' && typeof portalView.payload?.path === 'string'
            ? portalView.payload.path
            : null;
        if (count === 1) {
          await deleteWorkspaceEntry(agentId, paths[0]!);
        } else {
          await deleteWorkspaceEntries(agentId, paths);
        }
        setSelectedIds([]);
        if (portalPath && paths.includes(portalPath)) {
          usePortalStore.getState().clearPortalStack();
        }
      },
      title: '删除',
    });
  }, [agentId, portalView, selectedIds]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && primarySelectedId) {
        const node = findDocumentNodeByPath(documents, primarySelectedId);
        if (node) setRenamingNode(node);
        return;
      }
      if (e.key === 'Delete' && selectedIds.length > 0) {
        e.preventDefault();
        confirmDeleteSelected();
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [confirmDeleteSelected, documents, primarySelectedId, selectedIds.length]);

  const parentPath = resolveDocumentFolderPath(documents, primarySelectedId);

  const onToggle = useCallback((id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const onSelectClick = useCallback(
    (node: DocumentNode, e: React.MouseEvent) => {
      const path = nodePath(node);
      const multi = e.ctrlKey || e.metaKey;
      const range = e.shiftKey;

      if (range && selectionAnchorRef.current) {
        const visible = flattenVisibleDocumentPaths(documents, expanded);
        const from = visible.indexOf(selectionAnchorRef.current);
        const to = visible.indexOf(path);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelectedIds(visible.slice(start, end + 1));
          return;
        }
      }

      if (multi) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return [...next];
        });
        selectionAnchorRef.current = path;
        return;
      }

      selectionAnchorRef.current = path;
      setSelectedIds([path]);

      if (!isDocumentFolder(node)) {
        openPortalView('Document', { path, title: node.name, agentId: activeAgentId });
      }
    },
    [activeAgentId, documents, expanded],
  );

  const handleCreateFolder = useCallback(
    async (targetParent: string | null = parentPath) => {
      if (creating || !agentId) return;
      setCreating('folder');
      try {
        const path = await createWorkspaceFolder(agentId, targetParent);
        setExpanded((s) => ({ ...s, [path]: true }));
        setSelectedIds([path]);
      } catch {
        // errors surfaced via toast in documentTreeOps
      } finally {
        setCreating(null);
      }
    },
    [agentId, creating, parentPath],
  );

  const handleCreateDocument = useCallback(
    async (targetParent: string | null = parentPath) => {
      if (creating || !agentId) return;
      setCreating('document');
      try {
        const path = await createWorkspaceMarkdown(agentId, targetParent);
        const fileName = path.split('/').pop() ?? path;
        if (targetParent) {
          setExpanded((s) => ({ ...s, [targetParent]: true }));
        }
        setSelectedIds([path]);
        openPortalView('Document', { path, title: fileName, agentId: activeAgentId });
      } catch {
        // errors surfaced via toast in documentTreeOps
      } finally {
        setCreating(null);
      }
    },
    [activeAgentId, agentId, creating, parentPath],
  );

  const handleRenameByPath = useCallback(
    async (fromPath: string, newName: string) => {
      const node = findDocumentNodeByPath(documents, fromPath);
      if (!node) return;
      setRenamingNode(node);
      const toPath = await renameWorkspaceEntry(agentId, fromPath, newName);
      setSelectedIds([toPath]);
      if (
        portalView?.type === 'Document' &&
        portalView.payload?.path === fromPath
      ) {
        openPortalView('Document', {
          path: toPath,
          title: newName,
          agentId: activeAgentId,
        });
      }
      setRenamingNode(null);
    },
    [activeAgentId, agentId, documents, portalView],
  );

  const handleRename = useCallback(
    async (newName: string) => {
      if (!renamingNode) return;
      await handleRenameByPath(nodePath(renamingNode), newName);
    },
    [handleRenameByPath, renamingNode],
  );

  if (!available) {
    return (
      <Flexbox align="center" className={styles.root} flex={1} justify="center" paddingBlock={24}>
        <Empty
          description="文档仅在「本机」或「云端沙箱」模式下可用。请在输入栏切换执行设备。"
          icon={FileText}
        />
      </Flexbox>
    );
  }

  if (reason === 'sandbox_status_loading') {
    return (
      <div className={styles.root}>
        <div className={styles.loadingWrap}>
          <NeuralNetworkLoading size={48} />
        </div>
      </div>
    );
  }

  if (reason === 'sandbox_not_provisioned') {
    return (
      <Flexbox align="center" className={styles.root} flex={1} gap={12} justify="center" paddingBlock={24}>
        <Empty
          description="沙箱尚未创建，请先启动沙箱。"
          icon={FileText}
        />
        <Button
          type="primary"
          onClick={() => void useWorkspaceControlsStore.getState().startSandbox(agentId)}
        >
          启动沙箱
        </Button>
      </Flexbox>
    );
  }

  if (documentsValidating && documents.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.loadingWrap}>
          <NeuralNetworkLoading size={48} />
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className={styles.root} tabIndex={-1}>
      <div className={styles.toolbar}>
        <Flexbox horizontal align="center" gap={8}>
          <span className={styles.toolbarTitle}>文档</span>
          <span className={styles.toolbarCount}>{fileCount} 个文件</span>
        </Flexbox>
        <div className={styles.toolbarActions}>
          {selectedIds.length > 0 ? (
            <ActionIcon
              icon={Trash2}
              size="small"
              title={selectedIds.length > 1 ? `删除 ${selectedIds.length} 项` : '删除'}
              onClick={confirmDeleteSelected}
            />
          ) : null}
          <ActionIcon
            icon={RefreshCw}
            loading={documentsValidating}
            size="small"
            title="刷新"
            onClick={() => void handleRefresh()}
          />
          <ActionIcon
            icon={FolderPlus}
            loading={creating === 'folder'}
            size="small"
            title="新建文件夹"
            onClick={() => {
              void handleCreateFolder();
            }}
          />
          <ActionIcon
            icon={FilePlus}
            loading={creating === 'document'}
            size="small"
            title="新建文档"
            onClick={() => {
              void handleCreateDocument();
            }}
          />
        </div>
      </div>
      <Flexbox className={styles.tree} flex={1} style={{ minHeight: 0 }}>
        {documents.length === 0 ? (
          <Flexbox align="center" flex={1} justify="center" paddingBlock={24}>
            <Empty description="工作区暂无文档" icon={FileText} />
          </Flexbox>
        ) : (
          documents.map((node) => (
            <TreeNode
              agentId={agentId}
              dragPath={dragPath}
              expanded={expanded}
              key={node.id}
              node={node}
              selectedIds={selectedIds}
              onCreateDocument={(p) => void handleCreateDocument(p)}
              onCreateFolder={(p) => void handleCreateFolder(p)}
              onDragPathChange={setDragPath}
              onSelectClick={onSelectClick}
              onStartRename={setRenamingNode}
              onToggle={onToggle}
            />
          ))
        )}
      </Flexbox>
      <DocumentRenameModal
        currentName={renamingNode?.name ?? ''}
        open={Boolean(renamingNode)}
        onCancel={() => setRenamingNode(null)}
        onConfirm={handleRename}
      />
    </div>
  );
});
