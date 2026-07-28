import {
  ActionIcon,
  Center,
  DropdownMenu,
  Empty,
  Flexbox,
  type DropdownItem,
} from '@lobehub/ui';
import {
  ArrowLeft,
  ChevronDown,
  Columns2,
  FoldVertical,
  GitCompare,
  MoreHorizontal,
  RefreshCw,
  Rows2,
  UnfoldVertical,
  WholeWord,
  WrapText,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';
import {
  REVIEW_DEFAULT_EXPAND_BYTES,
  REVIEW_DEFAULT_EXPAND_FILE_COUNT,
} from '../../../constants/layoutTokens';
import type { ReviewFile } from '../../../domain/types';
import type { ReviewMode } from '../../../domain/types/review';
import { useLocalStorageState } from '../../../hooks/useLocalStorageState';
import { useWorkingSidebarAvailability } from '../../../hooks/useWorkingSidebarAvailability';
import { showToast } from '../../../services/ui/toast';
import { FileRow } from './FileRow';
import { reviewStyles } from './reviewStyles';
import {
  MOCK_REMOTE_BRANCHES,
  REVIEW_BASE_OVERRIDES_KEY,
  REVIEW_MODE_KEY,
  REVIEW_TEXT_DIFF_KEY,
  REVIEW_VIEW_MODE_KEY,
  REVIEW_WORD_WRAP_KEY,
  type ReviewViewMode,
} from './storageKeys';
import { useReviewPatches } from './useReviewPatches';

function patchBytes(file: ReviewFile): number {
  return file.diff.join('\n').length;
}

function fileKey(file: ReviewFile): string {
  return file.path;
}

function computeDefaultExpandedKeys(files: ReviewFile[]): string[] {
  const keys: string[] = [];
  let budget = REVIEW_DEFAULT_EXPAND_BYTES;
  for (const file of files) {
    if (keys.length >= REVIEW_DEFAULT_EXPAND_FILE_COUNT) break;
    const cost = patchBytes(file);
    if (keys.length > 0 && cost > budget) break;
    keys.push(fileKey(file));
    budget -= cost;
  }
  return keys;
}

/** §C.16 Review Diff*/
export const Review = memo(function Review() {
  const { workingDirectory } = useWorkingSidebarAvailability();

  const [mode, setMode] = useLocalStorageState<ReviewMode>(REVIEW_MODE_KEY, 'unstaged');
  const [baseOverrides, setBaseOverrides] = useLocalStorageState<Record<string, string>>(
    REVIEW_BASE_OVERRIDES_KEY,
    {},
  );
  const baseOverride = workingDirectory ? baseOverrides[workingDirectory] : undefined;
  const {
    patches: reviewFiles,
    baseRef: hookBaseRef,
    headRef,
    isLoading,
    refresh,
  } = useReviewPatches(workingDirectory, mode, baseOverride);
  const baseRef = baseOverride ?? hookBaseRef ?? 'main';

  const [viewMode, setViewMode] = useLocalStorageState<ReviewViewMode>(
    REVIEW_VIEW_MODE_KEY,
    'unified',
  );
  const [wordWrap, setWordWrap] = useLocalStorageState<boolean>(REVIEW_WORD_WRAP_KEY, false);
  const [textDiff, setTextDiff] = useLocalStorageState<boolean>(REVIEW_TEXT_DIFF_KEY, true);

  const signature = useMemo(
    () => reviewFiles.map((f) => fileKey(f)).join('|'),
    [reviewFiles],
  );
  const [seenSignature, setSeenSignature] = useState('');
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setActiveKeys(computeDefaultExpandedKeys(reviewFiles));
  }

  const totals = useMemo(
    () =>
      reviewFiles.reduce(
        (acc, file) => ({ add: acc.add + file.add, del: acc.del + file.del }),
        { add: 0, del: 0 },
      ),
    [reviewFiles],
  );

  const allExpanded =
    reviewFiles.length > 0 && activeKeys.length === reviewFiles.length;

  const toggleKey = (key: string) => {
    setActiveKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleToggleAll = () => {
    setActiveKeys(
      allExpanded ? [] : reviewFiles.map((f) => fileKey(f)),
    );
  };

  const handleRefresh = () => {
    void refresh().then(() => showToast('已刷新 diff'));
  };

  const modeMenuItems: DropdownItem[] = [
    { key: 'unstaged', label: '未暂存', onClick: () => setMode('unstaged') },
    { key: 'branch', label: '分支对比', onClick: () => setMode('branch') },
  ];

  const baseMenuItems: DropdownItem[] = [
    ...MOCK_REMOTE_BRANCHES.map((branch) => ({
      key: branch,
      label: branch,
      onClick: () => {
        if (!workingDirectory) return;
        setBaseOverrides((prev) => ({ ...prev, [workingDirectory]: branch }));
      },
    })),
    { type: 'divider' as const },
    {
      key: 'reset',
      label: '重置为默认',
      onClick: () =>
        setBaseOverrides((prev) => {
          const next = { ...prev };
          if (workingDirectory) delete next[workingDirectory];
          return next;
        }),
    },
  ];

  const moreMenuItems: DropdownItem[] = [
    {
      icon: RefreshCw,
      key: 'refresh',
      label: '刷新',
      onClick: handleRefresh,
    },
    { type: 'divider' },
    {
      icon: WrapText,
      key: 'wordWrap',
      label: wordWrap ? '关闭自动换行' : '开启自动换行',
      onClick: () => setWordWrap((w) => !w),
    },
    {
      icon: WholeWord,
      key: 'textDiff',
      label: textDiff ? '关闭词级 diff' : '开启词级 diff',
      onClick: () => setTextDiff((v) => !v),
    },
    {
      icon: viewMode === 'unified' ? Columns2 : Rows2,
      key: 'viewMode',
      label: viewMode === 'unified' ? '双栏视图' : '统一视图',
      onClick: () => setViewMode((m) => (m === 'unified' ? 'split' : 'unified')),
    },
  ];

  if (isLoading) {
    return (
      <Center flex={1} style={{ minHeight: 160 }}>
        <NeuralNetworkLoading size={48} />
      </Center>
    );
  }

  if (!reviewFiles.length) {
    return (
      <Center flex={1} style={{ minHeight: 160 }}>
        <Empty description="暂无 diff 变更" icon={GitCompare} />
      </Center>
    );
  }

  return (
    <Flexbox flex={1} style={{ minHeight: 0 }}>
      <div className={reviewStyles.subheader}>
        <Flexbox horizontal align="center" gap={6} style={{ minWidth: 0, overflow: 'hidden' }}>
          <DropdownMenu items={modeMenuItems} placement="bottomLeft">
            <span className={reviewStyles.scopeChip}>
              {mode === 'unstaged' ? '未暂存' : '分支对比'}
              <ChevronDown size={12} />
            </span>
          </DropdownMenu>
          {mode === 'branch' ? (
            <span className={reviewStyles.compareChip}>
              <DropdownMenu items={baseMenuItems} placement="bottomLeft">
                <span className={reviewStyles.basePicker}>
                  <span className={reviewStyles.refName}>{baseRef}</span>
                  <ChevronDown size={12} />
                </span>
              </DropdownMenu>
              <ArrowLeft className={reviewStyles.arrow} size={12} />
              <span className={reviewStyles.headRefText}>{headRef ?? 'HEAD'}</span>
            </span>
          ) : null}
          <span className={reviewStyles.totalStats}>
            <span className={reviewStyles.totalAdditions}>+{totals.add}</span>
            <span className={reviewStyles.totalDeletions}>-{totals.del}</span>
          </span>
        </Flexbox>
        <Flexbox horizontal align="center" gap={2}>
          <ActionIcon
            icon={allExpanded ? FoldVertical : UnfoldVertical}
            size="small"
            title={allExpanded ? '全部收起' : '全部展开'}
            onClick={handleToggleAll}
          />
          <DropdownMenu items={moreMenuItems} placement="bottomRight">
            <ActionIcon icon={MoreHorizontal} size="small" title="更多" />
          </DropdownMenu>
        </Flexbox>
      </div>

      <div className={reviewStyles.list}>
        {reviewFiles.map((file) => {
          const key = fileKey(file);
          return (
            <FileRow
              key={key}
              expanded={activeKeys.includes(key)}
              file={file}
              mode={mode}
              textDiff={textDiff}
              viewMode={viewMode}
              wordWrap={wordWrap}
              onToggle={() => toggleKey(key)}
            />
          );
        })}
      </div>
    </Flexbox>
  );
});
