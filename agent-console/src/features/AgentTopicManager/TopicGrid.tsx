import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useEffect, useMemo, useState } from 'react';
import { VList } from 'virtua';

import type { TopicViewGroup } from '../../domain/types/topicView';
import type { GroupBy } from './types';
import { TopicCard } from './TopicCard';
import { getProjectGroupTitle, getTimeGroupTitle } from './utils';

const GRID_GAP = 12;

const styles = createStaticStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: ${GRID_GAP}px;
  `,
  groupTitle: css`
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
    padding-block: 8px;
  `,
  virtualRow: css`
    display: grid;
    gap: ${GRID_GAP}px;
    padding-block-end: ${GRID_GAP}px;
  `,
}));

interface TopicGridProps {
  groupBy: GroupBy;
  groups: TopicViewGroup[];
  showGroupTitles: boolean;
}

function useGridColumnCount(): number {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 720) setCols(1);
      else if (w < 1100) setCols(2);
      else setCols(3);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

/** §C.53*/
export const TopicGrid = memo(function TopicGrid({
  groupBy,
  groups,
  showGroupTitles,
}: TopicGridProps) {
  const columnCount = useGridColumnCount();
  const flatTopics = useMemo(() => groups.flatMap((g) => g.children), [groups]);
  const virtualRows = useMemo(() => {
    const rows: TopicViewGroup['children'][] = [];
    for (let i = 0; i < flatTopics.length; i += columnCount) {
      rows.push(flatTopics.slice(i, i + columnCount));
    }
    return rows;
  }, [columnCount, flatTopics]);

  if (!showGroupTitles && flatTopics.length > columnCount * 2) {
    return (
      <VList style={{ height: 560 }}>
        {virtualRows.map((row, rowIndex) => (
          <div
            key={row.map((t) => t.id).join('-') || rowIndex}
            className={styles.virtualRow}
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {row.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        ))}
      </VList>
    );
  }

  return (
    <Flexbox gap={16}>
      {groups.map((group) => (
        <Flexbox key={group.id} gap={8}>
          {showGroupTitles ? (
            <Text className={styles.groupTitle}>
              {group.title ??
                (groupBy === 'byProject'
                  ? getProjectGroupTitle(group.id, group.children[0])
                  : getTimeGroupTitle(group.id))}
            </Text>
          ) : null}
          <div className={styles.grid}>
            {group.children.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </Flexbox>
      ))}
    </Flexbox>
  );
});
