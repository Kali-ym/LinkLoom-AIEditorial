import {
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  Flexbox,
  Icon,
  Input,
  Tooltip,
} from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { cssVar, cx } from 'antd-style';
import {
  Check,
  GitBranch,
  GitBranchPlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactElement,
} from 'react';

import { useWorkspaceControlsStore } from '../../../../stores/workspaceControlsStore';
import { showToast } from '../../../../services/ui/toast';
import { CreateBranchModal } from './CreateBranchModal';
import { RenameBranchModal } from './RenameBranchModal';
import { workspaceStyles } from './workspaceControlStyles';

/** §C.46*/
export const BranchSwitcher = memo(function BranchSwitcher({
  open,
  onOpenChange,
  children,
  currentBranch,
  path: _path,
  deviceId: _deviceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactElement;
  currentBranch?: string;
  path?: string;
  deviceId?: string;
}) {
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameFrom, setRenameFrom] = useState('');
  const branches = useWorkspaceControlsStore((s) => s.branches);
  const gitStatus = useWorkspaceControlsStore((s) => s.gitStatus);
  const refreshBranches = useWorkspaceControlsStore((s) => s.refreshBranches);
  const checkoutBranch = useWorkspaceControlsStore((s) => s.checkoutBranch);
  const createBranch = useWorkspaceControlsStore((s) => s.createBranch);
  const renameBranch = useWorkspaceControlsStore((s) => s.renameBranch);
  const deleteBranch = useWorkspaceControlsStore((s) => s.deleteBranch);
  const [refreshing, setRefreshing] = useState(false);

  const activeBranch = currentBranch ?? gitStatus.branch;

  const filtered = useMemo(
    () =>
      branches.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [branches, query],
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshBranches();
    setRefreshing(false);
    showToast('分支列表已刷新');
  }, [refreshBranches, refreshing]);

  const handleCheckout = useCallback(
    async (name: string) => {
      if (name === activeBranch) {
        onOpenChange(false);
        return;
      }
      await checkoutBranch(name);
      onOpenChange(false);
      showToast(`已切换分支：${name}`);
    },
    [activeBranch, checkoutBranch, onOpenChange],
  );

  const handleCreate = useCallback(
    async (name: string) => {
      const exists = branches.some((b) => b.name === name);
      if (exists) {
        return '分支已存在';
      }
      await createBranch(name);
      onOpenChange(false);
      showToast(`已创建分支：${name}`);
      return undefined;
    },
    [branches, createBranch, onOpenChange],
  );

  const handleRename = useCallback(
    async (newName: string) => {
      await renameBranch(renameFrom, newName);
      showToast('分支已重命名');
      return undefined;
    },
    [renameBranch, renameFrom],
  );

  const handleDelete = useCallback(
    (event: MouseEvent, branch: string) => {
      event.stopPropagation();
      onOpenChange(false);
      confirmModal({
        cancelText: '取消',
        content: `确定删除分支 ${branch}？`,
        okButtonProps: { danger: true },
        okText: '删除',
        onOk: () => void deleteBranch(branch),
        title: '删除分支',
      });
    },
    [deleteBranch, onOpenChange],
  );

  const openRename = useCallback(
    (event: MouseEvent, branch: string) => {
      event.stopPropagation();
      onOpenChange(false);
      setRenameFrom(branch);
      setRenameOpen(true);
    },
    [onOpenChange],
  );

  const openCreate = useCallback(() => {
    onOpenChange(false);
    setCreateOpen(true);
  }, [onOpenChange]);

  return (
    <>
      <DropdownMenuRoot open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>{children}</DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuPositioner placement="topLeft" sideOffset={8}>
            <DropdownMenuPopup>
              <div className={workspaceStyles.branchPopup}>
                <div className={workspaceStyles.branchSearch}>
                  <Input
                    autoFocus
                    placeholder="搜索分支"
                    prefix={<Icon icon={Search} size={14} />}
                    size="small"
                    value={query}
                    variant="borderless"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>

                <div className={workspaceStyles.branchSectionRow}>
                  <div className={workspaceStyles.branchSectionTitle}>分支</div>
                  <div
                    className={cx(workspaceStyles.refreshButton, refreshing && workspaceStyles.spin)}
                    role="button"
                    onClick={() => void handleRefresh()}
                  >
                    <Icon icon={RefreshCw} size={12} />
                  </div>
                </div>

                <div className={workspaceStyles.branchList}>
                  {filtered.length === 0 ? (
                    <span style={{ padding: 8, fontSize: 12, color: cssVar.colorTextTertiary }}>
                      暂无本地分支
                    </span>
                  ) : (
                    filtered.map((branch) => {
                      const isCurrent = branch.name === activeBranch;
                      const showUncommitted =
                        isCurrent && branch.hasUncommitted && !gitStatus.clean;
                      return (
                        <DropdownMenuItem
                          className={workspaceStyles.branchItem}
                          closeOnClick={false}
                          key={branch.name}
                          onClick={() => void handleCheckout(branch.name)}
                        >
                          <Icon icon={GitBranch} size={14} style={{ color: cssVar.colorTextSecondary }} />
                          <Flexbox flex={1} style={{ minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {branch.name}
                            </span>
                            {showUncommitted ? (
                              <div className={workspaceStyles.branchItemMeta}>
                                未提交的更改：{gitStatus.modified ?? 0} 个文件
                              </div>
                            ) : null}
                          </Flexbox>
                          {isCurrent ? (
                            <Check
                              className="branch-row-check"
                              color={cssVar.colorPrimary}
                              size={14}
                              style={{ flex: 'none' }}
                            />
                          ) : null}
                          <div className={cx('branch-row-actions', workspaceStyles.branchRowActions)}>
                            <Tooltip title="重命名分支">
                              <div
                                className={workspaceStyles.branchRowAction}
                                role="button"
                                onClick={(e) => openRename(e, branch.name)}
                              >
                                <Icon icon={Pencil} size={13} />
                              </div>
                            </Tooltip>
                            {!isCurrent ? (
                              <Tooltip title="删除分支">
                                <div
                                  className={cx(
                                    workspaceStyles.branchRowAction,
                                    workspaceStyles.branchRowActionDanger,
                                  )}
                                  role="button"
                                  onClick={(e) => handleDelete(e, branch.name)}
                                >
                                  <Icon icon={Trash2} size={13} />
                                </div>
                              </Tooltip>
                            ) : null}
                          </div>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </div>

                <div className={workspaceStyles.branchCreateRow} onClick={openCreate}>
                  <Icon icon={GitBranchPlus} size={14} />
                  检出新分支…
                </div>
              </div>
            </DropdownMenuPopup>
          </DropdownMenuPositioner>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <CreateBranchModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <RenameBranchModal
        currentName={renameFrom}
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onSubmit={handleRename}
      />
    </>
  );
});
