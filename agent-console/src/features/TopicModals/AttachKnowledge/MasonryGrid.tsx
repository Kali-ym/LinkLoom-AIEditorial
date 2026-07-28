import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useEffect, useMemo, useState } from 'react';
import { VList } from 'virtua';

import {
  KnowledgeResourceRow,
  type KnowledgeResourceItem,
} from './KnowledgeResourceItem';

const GRID_GAP = 16;

const masonryStyles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorBgContainer};
    transition: border-color ${cssVar.motionDurationMid}, box-shadow ${cssVar.motionDurationMid};

    &:hover {
      border-color: ${cssVar.colorPrimary};
      box-shadow: ${cssVar.boxShadowTertiary};
    }
  `,
  staticGrid: css`
    display: grid;
    gap: ${GRID_GAP}px;
    overflow-y: auto;
  `,
  virtualRow: css`
    display: grid;
    gap: ${GRID_GAP}px;
    padding-block-end: ${GRID_GAP}px;
  `,
}));

const MasonryCard = memo(function MasonryCard({
  item,
  onAdd,
  onRemove,
}: {
  item: KnowledgeResourceItem;
  onAdd: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  return (
    <div className={masonryStyles.card}>
      <KnowledgeResourceRow item={item} onAdd={onAdd} onRemove={onRemove} />
    </div>
  );
});

function useMasonryColumnCount(): number {
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const update = () => setColumnCount(window.innerWidth < 480 ? 1 : 2);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return columnCount;
}

interface KnowledgeMasonryGridProps {
  items: KnowledgeResourceItem[];
  onAdd: (item: KnowledgeResourceItem) => Promise<void>;
  onRemove: (item: KnowledgeResourceItem) => Promise<void>;
}

/** §C.52 — masonry 视图 virtua 行虚拟化（对齐 TopicGrid 模式） */
export const KnowledgeMasonryGrid = memo(function KnowledgeMasonryGrid({
  items,
  onAdd,
  onRemove,
}: KnowledgeMasonryGridProps) {
  const columnCount = useMasonryColumnCount();

  const virtualRows = useMemo(() => {
    const rows: KnowledgeResourceItem[][] = [];
    for (let i = 0; i < items.length; i += columnCount) {
      rows.push(items.slice(i, i + columnCount));
    }
    return rows;
  }, [columnCount, items]);

  const useVirtual = items.length > columnCount * 2;

  if (!useVirtual) {
    return (
      <Flexbox
        className={masonryStyles.staticGrid}
        flex={1}
        paddingInline={16}
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <MasonryCard
            key={item.id}
            item={item}
            onAdd={() => onAdd(item)}
            onRemove={() => onRemove(item)}
          />
        ))}
      </Flexbox>
    );
  }

  return (
    <VList style={{ flex: 1, minHeight: 0 }}>
      {virtualRows.map((row, rowIndex) => (
        <div
          key={row.map((item) => item.id).join('-') || rowIndex}
          className={masonryStyles.virtualRow}
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            paddingInline: 16,
          }}
        >
          {row.map((item) => (
            <MasonryCard
              key={item.id}
              item={item}
              onAdd={() => onAdd(item)}
              onRemove={() => onRemove(item)}
            />
          ))}
        </div>
      ))}
    </VList>
  );
});
