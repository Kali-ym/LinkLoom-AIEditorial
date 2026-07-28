import {
  ContextMenuTrigger,
  Flexbox,
  type GenericItemType,
  Icon,
  Text,
} from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { SkillsIcon } from '@lobehub/ui/icons';
import { cx } from 'antd-style';
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  type LucideIcon,
} from 'lucide-react';
import { memo, useCallback, useMemo, useState, type DragEvent, type ReactNode } from 'react';

import { skillsListStyles as styles } from './skillsListStyles';
import type { SkillListItem, SkillRowAction } from './types';

interface TreeNode {
  children: TreeNode[];
  isDirectory: boolean;
  name: string;
  path: string;
}

const buildSkillTree = (paths: string[]): TreeNode[] => {
  const root: TreeNode = { children: [], isDirectory: true, name: '', path: '' };

  for (const fullPath of paths) {
    const parts = fullPath.split('/').filter(Boolean);
    let current = root;
    let accumPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumPath = accumPath ? `${accumPath}/${part}` : part;
      const isDirectory = i < parts.length - 1;

      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { children: [], isDirectory, name: part, path: accumPath };
        current.children.push(child);
      }
      current = child;
    }
  }

  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) sortNode(child);
  };
  sortNode(root);

  return root.children;
};

const TREE_BASE_INSET = 24;
const TREE_DEPTH_INDENT = 14;

const TreeRow = memo(function TreeRow({
  depth,
  expanded,
  node,
  onOpenFile,
  onToggleFolder,
}: {
  depth: number;
  expanded: Set<string>;
  node: TreeNode;
  onOpenFile: (relativePath: string) => void;
  onToggleFolder: (folderPath: string) => void;
}) {
  const isOpen = expanded.has(node.path);
  const paddingInlineStart = TREE_BASE_INSET + depth * TREE_DEPTH_INDENT;

  if (node.isDirectory) {
    return (
      <>
        <Flexbox
          horizontal
          align="center"
          className={styles.childItem}
          gap={6}
          style={{ paddingInlineStart }}
          onClick={() => onToggleFolder(node.path)}
        >
          <span className={styles.treeChevronSlot}>
            <Icon
              className={cx(styles.chevron, isOpen && styles.chevronExpanded)}
              icon={ChevronRightIcon}
              size={12}
            />
          </span>
          <Icon className={styles.childItemIcon} icon={FolderIcon} size={12} />
          <Text ellipsis style={{ color: 'inherit', flex: 1, fontSize: 12, minWidth: 0 }}>
            {node.name}
          </Text>
        </Flexbox>
        {isOpen
          ? node.children.map((child) => (
              <TreeRow
                depth={depth + 1}
                expanded={expanded}
                key={child.path}
                node={child}
                onOpenFile={onOpenFile}
                onToggleFolder={onToggleFolder}
              />
            ))
          : null}
      </>
    );
  }

  return (
    <Flexbox
      horizontal
      align="center"
      className={styles.childItem}
      gap={6}
      style={{ paddingInlineStart }}
      title={node.path}
      onClick={() => onOpenFile(node.path)}
    >
      <span className={styles.treeChevronSlot} />
      <Icon className={styles.childItemIcon} icon={FileIcon} size={12} />
      <Text ellipsis style={{ color: 'inherit', flex: 1, fontSize: 12, minWidth: 0 }}>
        {node.name}
      </Text>
    </Flexbox>
  );
});

const SkillRow = memo(function SkillRow({
  actions,
  bindingEnabled,
  expanded,
  item,
  onBindingToggle,
  onDragStart,
  onOpenFile,
  onOpenSkill,
  onToggle,
  reserveChevronSlot,
}: {
  actions: SkillRowAction[];
  bindingEnabled?: boolean;
  expanded: boolean;
  item: SkillListItem;
  onBindingToggle?: (enabled: boolean) => void;
  onDragStart?: (event: DragEvent) => void;
  onOpenFile?: (relativePath: string) => void;
  onOpenSkill?: () => void;
  onToggle: () => void;
  reserveChevronSlot: boolean;
}) {
  const files = item.files ?? [];
  const hasFiles = files.length > 0;
  const hasActions = actions.length > 0;
  const tree = useMemo(() => buildSkillTree(files), [files]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  }, []);

  const contextMenuItems = useCallback(
    (): GenericItemType[] =>
      actions.map((action) => ({
        danger: action.danger,
        disabled: action.disabled,
        icon: <Icon icon={action.icon} />,
        key: action.key,
        label: action.label,
        onClick: () => action.onClick(item),
      })),
    [actions, item],
  );

  const nameNode: ReactNode = (
    <Text
      ellipsis
      style={{ color: 'inherit', flex: 1, minWidth: 0 }}
      title={item.description}
      onClick={onOpenSkill}
    >
      {item.name}
    </Text>
  );

  const row = (
    <Flexbox
      horizontal
      align="center"
      className={styles.item}
      draggable={!!onDragStart}
      gap={6}
      onDragStart={onDragStart}
    >
      {hasFiles ? (
        <Flexbox
          align="center"
          justify="center"
          style={{ cursor: 'pointer', flexShrink: 0, height: 20, width: 20 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <Icon
            className={cx(styles.chevron, expanded && styles.chevronExpanded)}
            icon={ChevronRightIcon}
            size={14}
          />
        </Flexbox>
      ) : reserveChevronSlot ? (
        <span style={{ flexShrink: 0, height: 20, width: 20 }} />
      ) : null}
      <Icon className={styles.itemIcon} icon={SkillsIcon} size={14} />
      {nameNode}
      {typeof item.fileCount === 'number' && item.fileCount > 0 ? (
        <span className={cx('skill-row-count', styles.itemCount)}>{item.fileCount}</span>
      ) : null}
      {onBindingToggle ? (
        <div
          className={styles.rowActions}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={Boolean(bindingEnabled)}
            size="small"
            onChange={(checked) => onBindingToggle(checked)}
          />
        </div>
      ) : null}
      {hasActions ? (
        <div className={cx('skill-row-actions', styles.rowActions)} draggable={false}>
          {actions.map((action) => (
            <div
              key={action.key}
              role="button"
              className={cx(
                styles.rowAction,
                action.danger && !action.disabled && styles.rowActionDanger,
                action.disabled && styles.rowActionDisabled,
              )}
              title={action.tooltip ?? action.label}
              onClick={(e) => {
                e.stopPropagation();
                if (action.disabled) return;
                action.onClick(item);
              }}
            >
              <Icon icon={action.icon as LucideIcon} size={13} />
            </div>
          ))}
        </div>
      ) : null}
    </Flexbox>
  );

  return (
    <>
      {hasActions ? (
        <ContextMenuTrigger items={contextMenuItems}>
          <div style={{ minWidth: 0 }}>{row}</div>
        </ContextMenuTrigger>
      ) : (
        row
      )}
      {expanded && hasFiles && onOpenFile
        ? tree.map((node) => (
            <TreeRow
              depth={0}
              expanded={expandedFolders}
              key={node.path}
              node={node}
              onOpenFile={onOpenFile}
              onToggleFolder={toggleFolder}
            />
          ))
        : null}
    </>
  );
});

export interface SkillsListProps {
  bindingEnabled?: (item: SkillListItem) => boolean;
  getRowActions?: (item: SkillListItem) => SkillRowAction[];
  items: SkillListItem[];
  onBindingToggle?: (item: SkillListItem, enabled: boolean) => void;
  onOpenFile?: (item: SkillListItem, relativePath: string) => void;
  onOpenSkill?: (item: SkillListItem) => void;
  onSkillDragStart?: (item: SkillListItem, event: DragEvent) => void;
}

/** §C.27*/
export const SkillsList = memo(function SkillsList({
  bindingEnabled,
  getRowActions,
  items,
  onBindingToggle,
  onOpenFile,
  onOpenSkill,
  onSkillDragStart,
}: SkillsListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const reserveChevronSlot = useMemo(
    () => items.some((item) => (item.files?.length ?? 0) > 0),
    [items],
  );

  return (
    <Flexbox gap={2}>
      {items.map((item) => {
        const actions = getRowActions?.(item) ?? [];
        return (
          <SkillRow
            actions={actions}
            bindingEnabled={bindingEnabled?.(item)}
            expanded={expanded.has(item.id)}
            item={item}
            key={item.id}
            reserveChevronSlot={reserveChevronSlot}
            onBindingToggle={
              onBindingToggle ? (enabled) => onBindingToggle(item, enabled) : undefined
            }
            onDragStart={
              onSkillDragStart ? (event) => onSkillDragStart(item, event) : undefined
            }
            onOpenFile={
              onOpenFile ? (relativePath) => onOpenFile(item, relativePath) : undefined
            }
            onOpenSkill={onOpenSkill ? () => onOpenSkill(item) : undefined}
            onToggle={() => toggle(item.id)}
          />
        );
      })}
    </Flexbox>
  );
});
