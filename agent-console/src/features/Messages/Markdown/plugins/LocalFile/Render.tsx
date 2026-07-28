import { File } from 'lucide-react';
import { memo } from 'react';

import { actionTagStyles } from '../../../../shared/editor';
import type { MarkdownElementProps } from '../type';

interface LocalFileNodeProps {
  isDirectory?: boolean | string;
  name?: string;
  path?: string;
}

/** Render persisted `<localFile name="…" path="…" />` tags. */
export const LocalFileRender = memo(function LocalFileRender({
  node,
  children,
}: MarkdownElementProps<LocalFileNodeProps>) {
  const name =
    (typeof node?.properties?.name === 'string' ? node.properties.name : undefined) ||
    (typeof children === 'string' ? children : undefined);
  if (!name) return null;

  return (
    <span className={`${actionTagStyles.actionTag} ${actionTagStyles.fileTag}`}>
      <span className={actionTagStyles.actionTagIcon}>
        <File size={14} />
      </span>
      <span>{name}</span>
    </span>
  );
});
