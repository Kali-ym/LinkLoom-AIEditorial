import { Checkbox, Flexbox, Icon, Popover, ScrollArea, Text, Tooltip } from '@lobehub/ui';
import { Github } from '@lobehub/icons';
import { ChevronDown } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { usePermission } from '../../../../hooks/usePermission';
import { useTopicStore } from '../../../../stores';
import { useWorkspaceControlsStore } from '../../../../stores/workspaceControlsStore';
import { popoverContentStyles, workspaceStyles } from './workspaceControlStyles';

const EMPTY_SELECTED_REPOS: string[] = [];

/** §C.46*/
export const CloudRepoSwitcher = memo(function CloudRepoSwitcher({
  agentId: _agentId,
}: {
  agentId: string;
}) {
  const [open, setOpen] = useState(false);
  const cloudRepos = useWorkspaceControlsStore((s) => s.cloudRepos);
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const selectedByTopic = useWorkspaceControlsStore(
    (s) => s.selectedReposByTopicId[activeTopicId] ?? EMPTY_SELECTED_REPOS,
  );
  const pendingTopicRepos = useWorkspaceControlsStore((s) => s.pendingTopicRepos);
  const toggleCloudRepo = useWorkspaceControlsStore((s) => s.toggleCloudRepo);
  const setPendingTopicRepos = useWorkspaceControlsStore((s) => s.setPendingTopicRepos);
  const commitWorkingDirectory = useWorkspaceControlsStore((s) => s.commitWorkingDirectory);
  const { allowed: canCreateContent, reason } = usePermission('create_content');

  const selected = activeTopicId ? selectedByTopic : pendingTopicRepos;

  const label = useMemo(() => {
    if (selected.length === 0) return '未选择仓库';
    if (selected.length === 1) return selected[0].split('/').pop() ?? selected[0];
    return `已选 ${selected.length} 个仓库`;
  }, [selected]);

  const handleToggle = (repo: string) => {
    if (!canCreateContent) return;
    if (activeTopicId) {
      const wasEmpty = selected.length === 0;
      toggleCloudRepo(activeTopicId, repo);
      const next = selected.includes(repo)
        ? selected.filter((r) => r !== repo)
        : [...selected, repo];
      if (wasEmpty && next.length > 0) {
        commitWorkingDirectory(next[0]);
      }
    } else {
      const next = selected.includes(repo)
        ? selected.filter((r) => r !== repo)
        : [...selected, repo];
      setPendingTopicRepos(next);
      if (selected.length === 0 && next.length > 0) {
        commitWorkingDirectory(next[0]);
      }
    }
  };

  if (cloudRepos.length === 0) return null;

  const trigger = (
    <button
      className={workspaceStyles.chipButton}
      disabled={!canCreateContent}
      style={{ opacity: canCreateContent ? 1 : 0.5 }}
      type="button"
    >
      <Icon icon={Github} size={14} />
      <span className={workspaceStyles.chipLabel}>{label}</span>
      <Icon icon={ChevronDown} size={12} />
    </button>
  );

  return (
    <Popover
      content={
        <div className={workspaceStyles.popoverContent} style={{ minWidth: 280 }}>
          <div className={workspaceStyles.sectionTitleUpper}>代码仓库</div>
          <ScrollArea className={workspaceStyles.scrollContainer}>
            {cloudRepos.map((repo) => {
              const checked = selected.includes(repo);
              return (
                <Flexbox
                  horizontal
                  align="center"
                  className={workspaceStyles.repoItem}
                  gap={10}
                  key={repo}
                  onClick={() => handleToggle(repo)}
                >
                  <Checkbox checked={checked} style={{ pointerEvents: 'none' }} />
                  <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
                    <Text ellipsis style={{ fontSize: 13 }}>
                      {repo.split('/').pop() ?? repo}
                    </Text>
                    <div className={workspaceStyles.repoUrl}>{repo}</div>
                  </Flexbox>
                </Flexbox>
              );
            })}
          </ScrollArea>
        </div>
      }
      open={canCreateContent && open}
      placement="bottomLeft"
      styles={popoverContentStyles}
      trigger="click"
      onOpenChange={setOpen}
    >
      {canCreateContent ? (
        trigger
      ) : (
        <Tooltip title={reason}>{trigger}</Tooltip>
      )}
    </Popover>
  );
});
