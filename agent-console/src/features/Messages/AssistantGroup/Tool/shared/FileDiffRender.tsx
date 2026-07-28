import { Flexbox } from '@lobehub/ui';
import { memo, type ReactNode } from 'react';

import { FileChangeDiff } from '../../../../../components/FileChangeDiff';

export interface FileDiffRenderProps {
  kind: 'modify' | 'create';
  path?: string;
  oldContent?: string;
  newContent?: string;
  maxHeight?: number;
  variant?: 'borderless' | 'outlined';
  footer?: ReactNode;
  /** Wrap in padded Flexbox shell (default true for completed tool renders). */
  padded?: boolean;
}

export const FileDiffRender = memo(function FileDiffRender({
  kind,
  path,
  oldContent,
  newContent,
  maxHeight,
  variant,
  footer,
  padded = true,
}: FileDiffRenderProps) {
  const diff = (
    <FileChangeDiff
      kind={kind}
      maxHeight={maxHeight}
      newContent={newContent}
      oldContent={oldContent}
      path={path}
      variant={variant}
    />
  );

  if (!padded && !footer) return diff;

  return (
    <Flexbox gap={12} paddingInline={padded ? 8 : undefined}>
      {diff}
      {footer}
    </Flexbox>
  );
});
