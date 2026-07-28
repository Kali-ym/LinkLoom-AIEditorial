import { Block, Checkbox, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Folder, MessageSquare, Star } from 'lucide-react';
import { memo, type MouseEvent, useCallback } from 'react';

import type { TopicViewItem } from '../../domain/types/topicView';
import { StatusDot } from './StatusDot';
import { useAgentTopicManagerNavigation } from './hooks/useAgentTopicManagerNavigation';
import { useTopicsViewStore } from './store';
import { getProjectLabel } from './utils';

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 140px;
    padding: 14px;
    transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgb(0 0 0 / 6%);
    }
  `,
  cardSelected: css`
    border-color: ${cssVar.colorPrimary};
    box-shadow: 0 0 0 1px ${cssVar.colorPrimary};
  `,
  checkbox: css`
    position: absolute;
    z-index: 1;
    inset-block-start: 10px;
    inset-inline-end: 10px;
  `,
  description: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
  footer: css`
    margin-block-start: auto;
    padding-block-start: 10px;
    border-block-start: 1px solid ${cssVar.colorSplit};
  `,
  title: css`
    overflow: hidden;
    display: -webkit-box;
    flex: 1;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  `,
}));

/** §C.53*/
export const TopicCard = memo(function TopicCard({ topic }: { topic: TopicViewItem }) {
  const navigateTopic = useAgentTopicManagerNavigation();
  const selectedIds = useTopicsViewStore((s) => s.selectedIds);
  const selectMode = useTopicsViewStore((s) => s.selectMode);
  const toggleSelected = useTopicsViewStore((s) => s.toggleSelected);
  const toggleSelectMode = useTopicsViewStore((s) => s.toggleSelectMode);

  const selected = selectedIds.includes(topic.id);
  const preview = topic.description ?? topic.historySummary ?? topic.firstUserMessage ?? '';

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (selectMode || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        if (!selectMode) toggleSelectMode();
        toggleSelected(topic.id);
        return;
      }
      navigateTopic(topic.id);
    },
    [navigateTopic, selectMode, toggleSelectMode, toggleSelected, topic.id],
  );

  return (
    <Block
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      variant="outlined"
      onClick={handleClick}
    >
      {(selectMode || selected) && (
        <Checkbox checked={selected} className={styles.checkbox} onChange={() => toggleSelected(topic.id)} />
      )}
      <Flexbox gap={8} style={{ flex: 1 }}>
        <Flexbox horizontal align="center" gap={6}>
          <StatusDot topic={topic} />
          <Text className={styles.title} weight={600}>
            {topic.title}
          </Text>
          {topic.fav ? <Icon color={cssVar.colorWarning} icon={Star} size="small" /> : null}
        </Flexbox>
        {preview ? (
          <Text className={styles.description} fontSize={12} type="secondary">
            {preview}
          </Text>
        ) : null}
        {topic.workingDirectory ? (
          <Tag icon={<Icon icon={Folder} size={12} />} size="small">
            {getProjectLabel(topic)}
          </Tag>
        ) : null}
      </Flexbox>
      <Flexbox horizontal align="center" className={styles.footer} gap={12}>
        <Flexbox horizontal align="center" gap={4}>
          <Icon color={cssVar.colorTextDescription} icon={MessageSquare} size={12} />
          <Text fontSize={11} type="secondary">
            {topic.messageCount ?? 0}
          </Text>
        </Flexbox>
        {topic.updatedAt ? (
          <Text fontSize={11} type="secondary">
            {new Date(topic.updatedAt).toLocaleDateString()}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});
