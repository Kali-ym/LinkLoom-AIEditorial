import { Checkbox, Flexbox, Icon, Tag } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { ChevronDown, ChevronUp, CircleArrowRight } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

import type { TodoItem } from '../../domain/types';
import { useActiveTopicStreaming } from '../../services/streaming/streamingScope';
import { shinyTextStyles } from '../../styles/shinyTextStyles';
import { useTopicStore, useWorkspaceStore } from '../../stores';
import { selectTodosForTopic } from '../../selectors/workspaceSelectors';
import { overlayStackStyles } from './overlayStackStyles';

const RING_SIZE = 14;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS;

const styles = createStaticStyles(({ css, cssVar }) => ({
  collapsed: css`
    max-height: 0;
    margin-block-start: 0 !important;
    padding-block: 0 !important;
    border-block-start: none !important;
    opacity: 0;
  `,
  container: css`
    cursor: pointer;
    user-select: none;
    padding-block: 8px 10px;
    padding-inline: 12px;
    transition: all 0.2s ${cssVar.motionEaseInOut};
  `,
  count: css`
    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  expanded: css`
    max-height: 300px;
    opacity: 1;
  `,
  header: css`
    overflow: hidden;
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  itemRow: css`
    padding-block: 6px;
    padding-inline: 4px;
    border-block-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 65%, transparent);
    font-size: 13px;

    &:last-child {
      border-block-end: none;
    }
  `,
  listContainer: css`
    overflow: hidden;
    margin-block-start: 8px;
    padding-block: 4px;
    border-block-start: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 65%, transparent);
    transition:
      max-height 0.25s ${cssVar.motionEaseInOut},
      opacity 0.2s ${cssVar.motionEaseInOut};
  `,
  processingRow: css`
    display: flex;
    gap: 6px;
    align-items: center;
  `,
  ring: css`
    transform: rotate(-90deg);
    flex-shrink: 0;
  `,
  ringProgress: css`
    transition:
      stroke-dashoffset 240ms ease,
      stroke 240ms ease;
  `,
  ringTrack: css`
    stroke: ${cssVar.colorFillSecondary};
  `,
  textCompleted: css`
    color: ${cssVar.colorTextQuaternary};
    text-decoration: line-through;
  `,
  textProcessing: css`
    color: ${cssVar.colorText};
  `,
  textTodo: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

function normalizeItems(todos: TodoItem[]) {
  return todos.map((item) => ({
    id: item.id,
    text: item.label,
    status: item.status ?? (item.done ? 'completed' : 'todo'),
  }));
}

/** §C.13 TodoProgress*/
export const TodoProgress = memo(function TodoProgress({
  topAttached,
}: {
  topAttached?: boolean;
}) {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const todos = useWorkspaceStore(selectTodosForTopic(activeTopicId));
  const isStreaming = useActiveTopicStreaming();
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => normalizeItems(todos), [todos]);
  const total = items.length;
  const completed = items.filter((item) => item.status === 'completed').length;

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  if (total === 0) return null;

  const processingItem = items.find((i) => i.status === 'processing');
  const allDone = completed === total;
  const completionPercent = total ? Math.round((completed / total) * 100) : 0;
  const ringColor = allDone ? cssVar.colorSuccess : cssVar.colorInfo;
  const ringOffset = RING_CIRCUM * (1 - completionPercent / 100);

  return (
    <div
      className={cx(
        overlayStackStyles.panel,
        styles.container,
        topAttached && overlayStackStyles.panelTopAttached,
      )}
      data-testid="input-todo-progress"
      onClick={toggleExpanded}
    >
      <Flexbox horizontal align="center" gap={8} justify="space-between">
        <Flexbox horizontal align="center" gap={8} style={{ flex: 1, minWidth: 0 }}>
          <svg className={styles.ring} height={RING_SIZE} width={RING_SIZE} aria-hidden>
            <circle
              className={styles.ringTrack}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              r={RING_RADIUS}
              strokeWidth={RING_STROKE}
            />
            <circle
              className={styles.ringProgress}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              fill="none"
              r={RING_RADIUS}
              stroke={ringColor}
              strokeDasharray={RING_CIRCUM}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              strokeWidth={RING_STROKE}
            />
          </svg>
          <span
            className={cx(
              styles.header,
              isStreaming && !processingItem && shinyTextStyles.shinyText,
            )}
          >
            {processingItem?.text ?? '进度'}
          </span>
          <Tag size="small" style={{ flexShrink: 0 }}>
            <span className={styles.count}>
              {completed}/{total}
            </span>
          </Tag>
        </Flexbox>
        <Icon
          icon={expanded ? ChevronUp : ChevronDown}
          size={16}
          style={{ color: cssVar.colorTextTertiary, flexShrink: 0 }}
        />
      </Flexbox>

      <div className={cx(styles.listContainer, expanded ? styles.expanded : styles.collapsed)}>
        {items.map((item, index) => {
          const isCompleted = item.status === 'completed';
          const isProcessing = item.status === 'processing';

          if (isProcessing) {
            return (
              <div className={cx(styles.itemRow, styles.processingRow)} key={item.id ?? index}>
                <Icon icon={CircleArrowRight} size={17} style={{ color: cssVar.colorTextSecondary }} />
                <span className={styles.textProcessing}>{item.text}</span>
              </div>
            );
          }

          return (
            <Checkbox
              backgroundColor={cssVar.colorSuccess}
              checked={isCompleted}
              key={item.id ?? index}
              shape="circle"
              style={{ borderWidth: 1.5, cursor: 'default', pointerEvents: 'none' }}
              classNames={{
                text: cx(styles.textTodo, isCompleted && styles.textCompleted),
                wrapper: styles.itemRow,
              }}
            >
              {item.text}
            </Checkbox>
          );
        })}
      </div>
    </div>
  );
});
