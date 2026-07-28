import { Icon, Tooltip } from '@lobehub/ui';
import { cx } from 'antd-style';
import { ArrowDown, ArrowUp, GitBranch, GitPullRequest } from 'lucide-react';
import { memo, useState } from 'react';

import { RingLoadingIcon } from '../../../../components/RingLoadingIcon';
import { useWorkingSidebarStore } from '../../../../stores/workingSidebarStore';
import { useWorkspaceControlsStore } from '../../../../stores/workspaceControlsStore';
import { showToast } from '../../../../services/ui/toast';
import { isDeferApiMode, runOrDefer, showDeferHint } from '../../../../features/shared';
import { BranchSwitcher } from './BranchSwitcher';
import { workspaceStyles } from './workspaceControlStyles';

/** §C.46*/
export const GitStatus = memo(function GitStatus({
  deviceId: _deviceId,
  path,
  repoType,
}: {
  deviceId?: string;
  path: string;
  repoType: 'git' | 'github';
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const gitStatus = useWorkspaceControlsStore((s) => s.gitStatus);
  const pulling = useWorkspaceControlsStore((s) => s.pulling);
  const pushing = useWorkspaceControlsStore((s) => s.pushing);
  const pull = useWorkspaceControlsStore((s) => s.pull);
  const push = useWorkspaceControlsStore((s) => s.push);
  const openWorkingSidebar = useWorkingSidebarStore((s) => s.openWorkingSidebar);

  if (!gitStatus.branch) return null;

  const syncBusy = pulling || pushing;
  const showDiff = !gitStatus.clean;
  const showBehind = gitStatus.hasUpstream && (gitStatus.behind ?? 0) > 0;
  const showAhead = gitStatus.hasUpstream && (gitStatus.ahead ?? 0) > 0;

  const branchTrigger = (
    <button className={workspaceStyles.chipButton} type="button">
      <Icon icon={GitBranch} size={12} />
      <span className={workspaceStyles.gitBranchLabel}>{gitStatus.branch}</span>
    </button>
  );

  const branchNode = gitStatus.detached ? (
    <Tooltip title={`游离 HEAD（${gitStatus.branch}）`}>{branchTrigger}</Tooltip>
  ) : (
    <BranchSwitcher
      currentBranch={gitStatus.branch}
      open={switcherOpen}
      path={path}
      onOpenChange={setSwitcherOpen}
    >
      {branchTrigger}
    </BranchSwitcher>
  );

  return (
    <>
      <span className={workspaceStyles.separator} />
      {branchNode}

      {showBehind ? (
        <Tooltip title="拉取远程更改">
          <button
            aria-busy={pulling}
            className={cx(workspaceStyles.chipButton, syncBusy && workspaceStyles.chipButtonDisabled)}
            disabled={syncBusy}
            type="button"
            onClick={() => {
              if (isDeferApiMode()) {
                showDeferHint('workspaceControls');
                return;
              }
              void pull().then(() => showToast('Pull 完成'));
            }}
          >
            {pulling ? (
              <RingLoadingIcon size={10} />
            ) : (
              <Icon icon={ArrowDown} size={10} />
            )}
            <span className={workspaceStyles.behindStat}>↓{gitStatus.behind}</span>
          </button>
        </Tooltip>
      ) : null}

      {showAhead ? (
        <Tooltip title="推送到远程">
          <button
            aria-busy={pushing}
            className={cx(workspaceStyles.chipButton, syncBusy && workspaceStyles.chipButtonDisabled)}
            disabled={syncBusy}
            type="button"
            onClick={() => {
              if (isDeferApiMode()) {
                showDeferHint('workspaceControls');
                return;
              }
              void push().then(() => showToast('Push 完成'));
            }}
          >
            {pushing ? (
              <RingLoadingIcon size={10} />
            ) : (
              <Icon icon={ArrowUp} size={10} />
            )}
            <span className={workspaceStyles.aheadStat}>↑{gitStatus.ahead}</span>
          </button>
        </Tooltip>
      ) : null}

      {showDiff ? (
        <Tooltip
          title={`+${gitStatus.added ?? 0} / ±${gitStatus.modified ?? 0} / -${gitStatus.deleted ?? 0}`}
        >
          <button
            className={workspaceStyles.chipButton}
            type="button"
            onClick={() => openWorkingSidebar({ tab: 'review' })}
          >
            <span className={workspaceStyles.diffStat}>
              {gitStatus.added ? (
                <span className={workspaceStyles.diffAdded}>+{gitStatus.added}</span>
              ) : null}
              {gitStatus.modified ? (
                <span className={workspaceStyles.diffModified}>±{gitStatus.modified}</span>
              ) : null}
              {gitStatus.deleted ? (
                <span className={workspaceStyles.diffDeleted}>-{gitStatus.deleted}</span>
              ) : null}
            </span>
          </button>
        </Tooltip>
      ) : null}

      {repoType === 'github' && gitStatus.pullRequest ? (
        <Tooltip title={gitStatus.pullRequest.url ?? `PR #${gitStatus.pullRequest.number}`}>
          <button
            className={workspaceStyles.chipButton}
            type="button"
            onClick={() =>
              runOrDefer('workspaceControls', () =>
                showToast(`打开 PR #${gitStatus.pullRequest?.number}`),
              )
            }
          >
            <Icon icon={GitPullRequest} size={12} />
            <span>#{gitStatus.pullRequest.number}</span>
          </button>
        </Tooltip>
      ) : null}
    </>
  );
});
