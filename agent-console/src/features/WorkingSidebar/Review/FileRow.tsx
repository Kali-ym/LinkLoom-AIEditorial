import { ActionIcon, copyToClipboard, PatchDiff } from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Copy, LocateFixed, Undo2 } from 'lucide-react';
import { memo, useCallback, type KeyboardEvent } from 'react';

import { REVIEW_FILE_ROW_EXPAND_DURATION_S } from '../../../constants/motionTokens';
import type { ReviewFile } from '../../../domain/types';
import type { ReviewMode } from '../../../domain/types/review';
import { runOrDefer } from '../../../features/shared';
import { showToast } from '../../../services/ui/toast';
import { inferLanguage, toUnifiedPatch } from '../../../utils/fileTree';
import type { ReviewViewMode } from './storageKeys';
import { formatReviewPath, reviewStyles } from './reviewStyles';

interface FileRowProps {
  file: ReviewFile;
  expanded: boolean;
  mode: ReviewMode;
  textDiff: boolean;
  viewMode: ReviewViewMode;
  wordWrap: boolean;
  onToggle: () => void;
}

/** §C.16 FileRow*/
export const FileRow = memo(function FileRow({
  file,
  expanded,
  mode,
  textDiff,
  viewMode,
  wordWrap,
  onToggle,
}: FileRowProps) {
  const { dir, name } = formatReviewPath(file.path);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  const handleRevert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      confirmModal({
        cancelText: '取消',
        content: `确定还原「${file.path}」的未暂存变更？`,
        okText: '还原',
        okButtonProps: { danger: true },
        onOk: () =>
          runOrDefer('gitRestore', () => showToast(`已还原 ${file.path}（演示）`)),
        title: '还原文件',
      });
    },
    [file.path],
  );

  return (
    <div className={reviewStyles.fileRowItem}>
      <div
        aria-expanded={expanded}
        className={reviewStyles.fileRow}
        data-review-row
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={onKeyDown}
      >
        <ChevronRight
          className={reviewStyles.chevron}
          data-expanded={expanded ? 'true' : 'false'}
          size={14}
        />
        <div className={reviewStyles.fileHeader}>
          <div className={reviewStyles.pathWrapper}>
            {dir ? <span className={reviewStyles.dir}>{dir}</span> : null}
            <span className={reviewStyles.fileName}>{name}</span>
          </div>
          <span className={reviewStyles.stats}>
            <span className={reviewStyles.additions}>+{file.add}</span>{' '}
            <span className={reviewStyles.deletions}>-{file.del}</span>
          </span>
          <div className={reviewStyles.rowActions}>
            <ActionIcon
              className="review-row-action"
              icon={Copy}
              size="small"
              title="复制路径"
              onClick={(e) => {
                e.stopPropagation();
                void copyToClipboard(file.path).then(() => showToast('已复制路径'));
              }}
            />
            <ActionIcon
              className="review-row-action"
              icon={LocateFixed}
              size="small"
              title="在文件树中定位"
              onClick={(e) => {
                e.stopPropagation();
                showToast(`定位文件：${file.path}`);
              }}
            />
            {mode === 'unstaged' ? (
              <ActionIcon
                className="review-row-action"
                icon={Undo2}
                size="small"
                title="还原"
                onClick={handleRevert}
              />
            ) : null}
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
            transition={{ duration: REVIEW_FILE_ROW_EXPAND_DURATION_S }}
          >
            <PatchDiff
              fileName={file.path}
              language={inferLanguage(file.path)}
              patch={toUnifiedPatch(file)}
              showHeader={false}
              variant="borderless"
              viewMode={viewMode}
              diffOptions={{
                lineDiffType: textDiff ? 'word-alt' : 'none',
              }}
              styles={{
                body: { whiteSpace: wordWrap ? 'pre-wrap' : 'pre' },
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
