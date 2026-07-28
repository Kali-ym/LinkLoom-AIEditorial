import { Center, Empty, Flexbox } from '@lobehub/ui';
import { BookOpen } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { VList } from 'virtua';

import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';
import { SkeletonList } from '../../NavPanel/SkeletonList';
import { useAgentStore, useConfigStore } from '../../../stores';
import { topicModalStrings } from '../topicModalStrings';
import {
  KnowledgeResourceRow,
  type KnowledgeResourceItem,
} from './KnowledgeResourceItem';
import { KnowledgeMasonryGrid } from './MasonryGrid';
import { KnowledgeViewSwitcher, type KnowledgeModalViewMode } from './ViewSwitcher';

/** §C.52*/
export const AttachKnowledgeList = memo(function AttachKnowledgeList() {
  const viewMode = useConfigStore((s) => s.knowledgeBaseModalViewMode);
  const setKnowledgeBaseModalViewMode = useConfigStore((s) => s.setKnowledgeBaseModalViewMode);
  const files = useAgentStore((s) => s.getActivePlusState().files);
  const knowledgeBases = useAgentStore((s) => s.getActivePlusState().knowledgeBases);
  const toggleFile = useAgentStore((s) => s.toggleFile);
  const toggleKnowledgeBase = useAgentStore((s) => s.toggleKnowledgeBase);
  const isConfigLoading = useAgentStore((s) => s.isConfigLoading);

  const [isTransitioning, setIsTransitioning] = useState(false);

  const items = useMemo((): KnowledgeResourceItem[] => {
    const kbItems: KnowledgeResourceItem[] = knowledgeBases.map((kb) => ({
      description: '知识库',
      enabled: kb.enabled,
      id: kb.id,
      name: kb.name,
      type: 'knowledgeBase',
    }));
    const fileItems: KnowledgeResourceItem[] = files.map((file) => ({
      description: '文件',
      enabled: file.enabled,
      id: file.id,
      name: file.name,
      type: 'file',
    }));
    return [...kbItems, ...fileItems];
  }, [files, knowledgeBases]);

  const setViewMode = (mode: KnowledgeModalViewMode) => {
    setIsTransitioning(true);
    setKnowledgeBaseModalViewMode(mode);
  };

  useEffect(() => {
    if (!isTransitioning) return;
    const timer = window.setTimeout(() => setIsTransitioning(false), 100);
    return () => window.clearTimeout(timer);
  }, [isTransitioning, viewMode]);

  const handleAdd = useCallback(
    async (item: KnowledgeResourceItem) => {
      if (item.type === 'knowledgeBase') toggleKnowledgeBase(item.id, true);
      else toggleFile(item.id, true);
    },
    [toggleFile, toggleKnowledgeBase],
  );

  const handleRemove = useCallback(
    async (item: KnowledgeResourceItem) => {
      if (item.type === 'knowledgeBase') toggleKnowledgeBase(item.id, false);
      else toggleFile(item.id, false);
    },
    [toggleFile, toggleKnowledgeBase],
  );

  const isEmpty = items.length === 0;
  const showLoading = isConfigLoading || isTransitioning;

  return (
    <Flexbox height={500}>
      <Flexbox paddingInline={16} style={{ paddingBlockEnd: 12 }}>
        <Flexbox horizontal align="center" justify="flex-end">
          <KnowledgeViewSwitcher view={viewMode} onViewChange={setViewMode} />
        </Flexbox>
      </Flexbox>
      {showLoading ? (
        <Flexbox align="center" flex={1} justify="center">
          {isConfigLoading ? <NeuralNetworkLoading size={32} /> : <SkeletonList rows={5} />}
        </Flexbox>
      ) : isEmpty ? (
        <Center gap={12} padding={40}>
          <Empty
            description={topicModalStrings.knowledgeEmpty}
            descriptionProps={{ fontSize: 14 }}
            icon={BookOpen}
            style={{ maxWidth: 400 }}
          />
        </Center>
      ) : viewMode === 'list' ? (
        <VList style={{ flex: 1, minHeight: 0 }}>
          {items.map((item) => (
            <KnowledgeResourceRow
              key={item.id}
              item={item}
              onAdd={() => handleAdd(item)}
              onRemove={() => handleRemove(item)}
            />
          ))}
        </VList>
      ) : (
        <KnowledgeMasonryGrid items={items} onAdd={handleAdd} onRemove={handleRemove} />
      )}
    </Flexbox>
  );
});
