import { ActionIcon, Flexbox, Icon, Popover, ScrollArea, Text, Tooltip } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Check, ChevronDown, FolderOpen, FolderPlus, X } from 'lucide-react';
import { memo, useState, type MouseEvent } from 'react';

import { DEFAULT_AGENCY_CONFIG } from '../../../../domain/defaults/workspaceControls';
import { useAgentStore, useTopicStore } from '../../../../stores';
import { useWorkspaceControlsStore } from '../../../../stores/workspaceControlsStore';
import { useWorkspaceStore } from '../../../../stores/workspaceStore';
import { showToast } from '../../../../services/ui/toast';
import { runOrDefer } from '../../../../features/shared';
import { IS_ADMIN_DESKTOP } from '../helpers/platform';
import { useEffectiveWorkingDirectory } from '../hooks/useEffectiveWorkingDirectory';
import { AddWorkingDirModal } from './AddWorkingDirModal';
import { DirIcon } from './DirIcon';
import { popoverContentStyles, workspaceStyles } from './workspaceControlStyles';

const getDirName = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

/** §C.46*/
export const WorkingDirectoryPicker = memo(function WorkingDirectoryPicker({
  agentId,
}: {
  agentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const path = useEffectiveWorkingDirectory(agentId);
  const recentDirs = useWorkspaceControlsStore((s) => s.recentDirs);
  const commitWorkingDirectory = useWorkspaceControlsStore((s) => s.commitWorkingDirectory);
  const removeRecentDir = useWorkspaceControlsStore((s) => s.removeRecentDir);
  const removeDeviceWorkingDir = useWorkspaceControlsStore((s) => s.removeDeviceWorkingDir);
  const validateWorkingDirPath = useWorkspaceControlsStore((s) => s.validateWorkingDirPath);
  const agency = useWorkspaceControlsStore(
    (s) => s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG,
  );
  const setTopicWorkingDirectory = useTopicStore((s) => s.setTopicWorkingDirectory);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const topicWorkingDirectory = useTopicStore((s) =>
    activeTopicId ? s.topics.find((t) => t.id === activeTopicId)?.workingDirectory : undefined,
  );
  const agentWorkingDirectory = useAgentStore(
    (s) => s.agents.find((a) => a.id === agentId)?.workingDirectory,
  );
  const workspaceDir = useWorkspaceStore((s) => s.workingDir);
  const deviceDir = agency.boundDeviceId
    ? agency.workingDirByDevice?.[agency.boundDeviceId]
    : undefined;

  const isRemoteDevice = Boolean(agency.boundDeviceId) && agency.executionTarget === 'device';
  const isLocalDevice = IS_ADMIN_DESKTOP && !isRemoteDevice;

  const display = path ? getDirName(path) : '点击设置工作目录';

  const hasClearableSelection = Boolean(
    topicWorkingDirectory || deviceDir || agentWorkingDirectory || workspaceDir,
  );

  const pickPath = (next: string, repoType?: 'git' | 'github') => {
    void repoType;
    commitWorkingDirectory(next);
    if (activeTopicId) setTopicWorkingDirectory(activeTopicId, next);
    setOpen(false);
    showToast(`工作目录：${next}`);
  };

  const clearPath = () => {
    if (activeTopicId && topicWorkingDirectory) {
      setTopicWorkingDirectory(activeTopicId, undefined);
    } else if (agency.boundDeviceId && deviceDir) {
      useWorkspaceControlsStore.setState((s) => {
        const prev = s.agencyByAgentId[agentId] ?? DEFAULT_AGENCY_CONFIG;
        const nextDirs = { ...prev.workingDirByDevice };
        delete nextDirs[agency.boundDeviceId!];
        return {
          agencyByAgentId: {
            ...s.agencyByAgentId,
            [agentId]: { ...prev, workingDirByDevice: nextDirs },
          },
        };
      });
    } else {
      useWorkspaceStore.setState({ workingDir: '' });
    }
    setOpen(false);
    showToast('已清除目录');
  };

  const handleRemoveDir = (dirPath: string, e: MouseEvent) => {
    e.stopPropagation();
    if (isRemoteDevice && agency.boundDeviceId) {
      removeDeviceWorkingDir(agentId, agency.boundDeviceId, dirPath);
    } else {
      removeRecentDir(dirPath);
    }
  };

  return (
    <>
      <Popover
        content={
          <div className={workspaceStyles.popoverContent} style={{ minWidth: 280 }}>
            <div className={workspaceStyles.sectionTitle}>最近使用</div>
            <ScrollArea className={workspaceStyles.scrollContainer}>
              {recentDirs.length === 0 ? (
                <Text style={{ padding: '8px', fontSize: 12 }} type="secondary">
                  暂无最近目录
                </Text>
              ) : (
                recentDirs.map((dir) => {
                  const active = path === dir.path;
                  return (
                    <Flexbox
                      horizontal
                      align="center"
                      className={workspaceStyles.dirItem}
                      data-active={active}
                      gap={8}
                      key={dir.path}
                      onClick={() => pickPath(dir.path)}
                    >
                      <DirIcon size={16} />
                      <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
                        <div className={workspaceStyles.dirName}>{dir.name}</div>
                        <div className={workspaceStyles.dirPath}>{dir.path}</div>
                      </Flexbox>
                      {active ? (
                        <Check color={cssVar.colorSuccess} size={16} />
                      ) : (
                        <ActionIcon
                          icon={X}
                          size="small"
                          title="移除"
                          onClick={(e) => handleRemoveDir(dir.path, e)}
                        />
                      )}
                    </Flexbox>
                  );
                })
              )}
            </ScrollArea>
            {hasClearableSelection ? (
              <div className={workspaceStyles.clearText} onClick={clearPath}>
                清除目录
              </div>
            ) : null}
            {isLocalDevice ? (
              <div
                className={workspaceStyles.chooseFolderRow}
                onClick={() => {
                  runOrDefer('workspaceControls', () => {
                    showToast('选择文件夹（演示：Electron 对话框）');
                    pickPath('~/projects/new-folder');
                  });
                }}
              >
                <Icon icon={FolderOpen} size={14} />
                选择其他文件夹
              </div>
            ) : (
              <div
                className={workspaceStyles.chooseFolderRow}
                onClick={() => {
                  setOpen(false);
                  setAddModalOpen(true);
                }}
              >
                <Icon icon={FolderPlus} size={14} />
                添加目录…
              </div>
            )}
          </div>
        }
        open={open}
        placement="bottomLeft"
        styles={popoverContentStyles}
        trigger="click"
        onOpenChange={setOpen}
      >
        <Tooltip title={path || '点击设置工作目录'}>
          <button className={workspaceStyles.chipButton} type="button">
            <DirIcon size={14} />
            <span className={workspaceStyles.chipLabel}>{display}</span>
            <Icon icon={ChevronDown} size={12} />
          </button>
        </Tooltip>
      </Popover>

      <AddWorkingDirModal
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onSubmit={async (nextPath) => {
          const error = await validateWorkingDirPath(nextPath);
          if (error) return error;
          pickPath(nextPath);
          return undefined;
        }}
      />
    </>
  );
});
