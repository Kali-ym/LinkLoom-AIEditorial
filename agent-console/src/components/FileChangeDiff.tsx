import { CodeDiff, Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo } from 'react';

import { codeBlockScroll } from '../styles/scrollMixins';
import { basename, extname } from '../utils/filePath';

export type FileChangeKind = 'create' | 'modify' | 'delete';

export interface FileChangeDiffProps {
  kind?: FileChangeKind;
  maxHeight?: number;
  newContent?: string;
  oldContent?: string;
  path?: string;
  showHeader?: boolean;
  style?: React.CSSProperties;
  className?: string;
  variant?: 'borderless' | 'outlined';
}

function resolveContents(
  oldContent: string,
  newContent: string,
  kind?: FileChangeKind,
): { old: string; new: string } {
  const resolved = kind ?? (!oldContent && newContent ? 'create' : oldContent && !newContent ? 'delete' : 'modify');
  if (resolved === 'create') return { old: '', new: newContent };
  if (resolved === 'delete') return { old: oldContent, new: '' };
  return { old: oldContent, new: newContent };
}

/** Unified file create / modify / delete diff — `@lobehub/ui` CodeDiff wrapper */
export const FileChangeDiff = memo(function FileChangeDiff({
  kind,
  maxHeight,
  newContent = '',
  oldContent = '',
  path = '',
  showHeader,
  style,
  className,
  variant = 'borderless',
}: FileChangeDiffProps) {
  const { old, new: next } = resolveContents(oldContent, newContent, kind);
  if (!old && !next) return null;

  const fileName = path ? basename(path) : '';
  const language = path ? extname(path) || undefined : undefined;

  return (
    <Flexbox
      className={cx(codeBlockScroll, className)}
      style={{ maxHeight, ...style }}
    >
      <CodeDiff
        fileName={fileName || path || undefined}
        language={language}
        newContent={next}
        oldContent={old}
        showHeader={showHeader ?? Boolean(fileName || path)}
        variant={variant}
        viewMode="unified"
      />
    </Flexbox>
  );
});
