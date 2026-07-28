import { FileTypeIcon, Icon } from '@lobehub/ui';
import type { DropdownItem } from '@lobehub/ui';
import { LibraryBig } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useAgentStore } from '../../../../stores';
import { openAttachKnowledgeModal } from '../../../TopicModals/AttachKnowledge';
import { plusStrings } from '../../plusStrings';
import { plusMenuStyles } from './plusMenuStyles';

export function useKnowledgeControls({
  onViewMore,
}: {
  onViewMore: () => void;
}): {
  enabledCount: number;
  footer: ReactNode;
  items: DropdownItem[];
} {
  const files = useAgentStore((s) => s.getActivePlusState().files);
  const knowledgeBases = useAgentStore((s) => s.getActivePlusState().knowledgeBases);
  const toggleFile = useAgentStore((s) => s.toggleFile);
  const toggleKnowledgeBase = useAgentStore((s) => s.toggleKnowledgeBase);

  return useMemo(() => {
    const enabledCount =
      files.filter((item) => item.enabled).length +
      knowledgeBases.filter((item) => item.enabled).length;

    const libraryItems: DropdownItem[] = knowledgeBases.map((item) => ({
      checked: item.enabled,
      icon: LibraryBig,
      key: `kb-${item.id}`,
      label: item.name,
      onCheckedChange: (checked) => toggleKnowledgeBase(item.id, checked),
      type: 'switch',
    }));

    const fileItems: DropdownItem[] = files.map((item) => ({
      checked: item.enabled,
      icon: (
        <FileTypeIcon
          filetype={item.name.split('.').pop()}
          size={20}
          type="file"
        />
      ),
      key: `file-${item.id}`,
      label: item.name,
      onCheckedChange: (checked) => toggleFile(item.id, checked),
      type: 'switch',
    }));

    const items = [...libraryItems, ...fileItems];

    const footer = (
      <button
        className={plusMenuStyles.viewMoreFooter}
        type="button"
        onClick={() => {
          onViewMore();
          openAttachKnowledgeModal();
        }}
      >
        <Icon icon={LibraryBig} size={16} />
        <span>{plusStrings.viewMoreKb}</span>
      </button>
    );

    return { enabledCount, footer, items };
  }, [files, knowledgeBases, onViewMore, toggleFile, toggleKnowledgeBase]);
}
