import { ActionIcon, Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Grid3x3, List } from 'lucide-react';
import { memo } from 'react';

export type KnowledgeModalViewMode = 'list' | 'masonry';

interface ViewSwitcherProps {
  onViewChange: (view: KnowledgeModalViewMode) => void;
  view: KnowledgeModalViewMode;
}

const styles = createStaticStyles(({ css }) => ({
  container: css`
    gap: 4px;
  `,
}));

/** §C.52*/
export const KnowledgeViewSwitcher = memo(function KnowledgeViewSwitcher({
  onViewChange,
  view,
}: ViewSwitcherProps) {
  return (
    <Flexbox horizontal className={styles.container}>
      <ActionIcon
        active={view === 'list'}
        icon={List}
        size={16}
        title="列表视图"
        onClick={() => onViewChange('list')}
      />
      <ActionIcon
        active={view === 'masonry'}
        icon={Grid3x3}
        size={16}
        title="卡片视图"
        onClick={() => onViewChange('masonry')}
      />
    </Flexbox>
  );
});
