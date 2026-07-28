import { Input, Select, Text } from '@lobehub/ui';
import { memo } from 'react';

import type { DocumentFrontmatter } from '../../../domain/utils/markdownFrontmatter';
import {
  FRONTMATTER_STATUS_OPTIONS,
  patchDocumentFrontmatter,
} from '../../../domain/utils/markdownFrontmatter';
import { portalViewStyles } from '../portalViewStyles';

const STATUS_OPTIONS = FRONTMATTER_STATUS_OPTIONS.map((value) => ({
  label: value,
  value,
}));

export const DocumentFrontmatterCard = memo(function DocumentFrontmatterCard({
  editable,
  frontmatter,
  onChange,
}: {
  editable: boolean;
  frontmatter: DocumentFrontmatter;
  onChange?: (next: DocumentFrontmatter) => void;
}) {
  const title = frontmatter.title ?? '';
  const status = frontmatter.status ?? 'draft';
  const tags = frontmatter.tags ?? '';

  const emit = (patch: Partial<Pick<DocumentFrontmatter, 'title' | 'status' | 'tags'>>) => {
    onChange?.(patchDocumentFrontmatter(frontmatter, patch));
  };

  return (
    <div className={portalViewStyles.frontmatterCard}>
      <div className={portalViewStyles.metadataRow}>
        <span className={portalViewStyles.metadataKey}>title</span>
        {editable ? (
          <Input
            size="small"
            style={{ flex: 1, minWidth: 0 }}
            value={title}
            variant="borderless"
            onChange={(e) => emit({ title: e.target.value })}
          />
        ) : (
          <Text fontSize={13}>{title || '—'}</Text>
        )}
      </div>
      <div className={portalViewStyles.metadataRow}>
        <span className={portalViewStyles.metadataKey}>status</span>
        {editable ? (
          <Select
            size="small"
            style={{ flex: 1, minWidth: 0 }}
            value={status}
            variant="borderless"
            options={STATUS_OPTIONS}
            onChange={(value) => emit({ status: String(value) })}
          />
        ) : (
          <Text fontSize={13}>{status}</Text>
        )}
      </div>
      <div className={portalViewStyles.metadataRow}>
        <span className={portalViewStyles.metadataKey}>tags</span>
        {editable ? (
          <Input
            placeholder="agent, portal"
            size="small"
            style={{ flex: 1, minWidth: 0 }}
            value={tags}
            variant="borderless"
            onChange={(e) => emit({ tags: e.target.value })}
          />
        ) : (
          <Text fontSize={13}>{tags || '—'}</Text>
        )}
      </div>
    </div>
  );
});
