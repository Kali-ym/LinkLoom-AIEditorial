import { Block, Checkbox, Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { CircleArrowRight, CircleCheckBig, ListTodo } from 'lucide-react';
import { memo, useMemo } from 'react';

import { toolRenderStyles } from '../../shared/toolRenderStyles';
import type { TodoPanelItem } from './todoPanelNormalize';

export type { TodoPanelItem, TodoUpdateItem } from './todoPanelNormalize';
export {
  enrichTodoUpdates,
  normalizeTodoPanelItems,
  parseTodoUpdates,
  readTodoUpdateSummary,
} from './todoPanelNormalize';

const todoStyles = createStaticStyles(({ css, cssVar }) => ({
  listBody: css`
    padding-block: 4px;
  `,
  itemRow: css`
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding-block: 11px;
    padding-inline: 14px;
    border-block-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    transition: background-color 0.15s ${cssVar.motionEaseOut};

    &:last-child {
      border-block-end: none;
    }

    &:hover {
      background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 50%, transparent);
    }
  `,
  index: css`
    flex-shrink: 0;
    width: 18px;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorTextQuaternary};
    text-align: center;
  `,
  label: css`
    flex: 1;
    min-width: 0;
    font-size: 13px;
    line-height: 1.45;
    color: ${cssVar.colorText};
    word-break: break-word;
  `,
  textCompleted: css`
    color: ${cssVar.colorTextQuaternary};
    text-decoration: line-through;
  `,
  textProcessing: css`
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  statusChip: css`
    flex-shrink: 0;
    padding-block: 2px;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.35;
  `,
  statusPending: css`
    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
  `,
  statusProgress: css`
    color: ${cssVar.colorInfoText};
    background: ${cssVar.colorInfoBg};
  `,
  statusDone: css`
    color: ${cssVar.colorSuccessText};
    background: ${cssVar.colorSuccessBg};
  `,
}));

function statusMeta(status?: TodoPanelItem['status']) {
  if (status === 'in_progress') {
    return { chip: todoStyles.statusProgress, label: '进行中' };
  }
  if (status === 'completed') {
    return { chip: todoStyles.statusDone, label: '已完成' };
  }
  return { chip: todoStyles.statusPending, label: '待办' };
}

const TodoRow = memo(function TodoRow({
  index,
  item,
}: {
  index: number;
  item: TodoPanelItem;
}) {
  const { status, content, activeForm } = item;
  const label = content?.trim() || '—';
  const meta = statusMeta(status);

  if (status === 'in_progress') {
    return (
      <div className={todoStyles.itemRow}>
        <span className={todoStyles.index}>{index + 1}</span>
        <Icon icon={CircleArrowRight} size={17} style={{ color: cssVar.colorInfo, flexShrink: 0 }} />
        <span className={cx(todoStyles.label, todoStyles.textProcessing)}>{activeForm || label}</span>
        <span className={cx(todoStyles.statusChip, meta.chip)}>{meta.label}</span>
      </div>
    );
  }

  const isCompleted = status === 'completed';
  return (
    <div className={todoStyles.itemRow}>
      <span className={todoStyles.index}>{index + 1}</span>
      <Checkbox
        backgroundColor={cssVar.colorSuccess}
        checked={isCompleted}
        shape="circle"
        style={{ borderWidth: 1.5, cursor: 'default', flexShrink: 0 }}
      />
      <span className={cx(todoStyles.label, isCompleted && todoStyles.textCompleted)}>{label}</span>
      <span className={cx(todoStyles.statusChip, meta.chip)}>{meta.label}</span>
    </div>
  );
});

export const TodoPanel = memo(function TodoPanel({ todos }: { todos?: TodoPanelItem[] }) {
  const stats = useMemo(() => {
    const items = todos ?? [];
    return {
      completed: items.filter((t) => t?.status === 'completed').length,
      inProgress: items.find((t) => t?.status === 'in_progress'),
      total: items.length,
    };
  }, [todos]);

  if (!todos?.length) return null;

  const icon = stats.inProgress
    ? CircleArrowRight
    : stats.completed === stats.total
      ? CircleCheckBig
      : ListTodo;
  const color = stats.inProgress
    ? cssVar.colorInfo
    : stats.completed === stats.total
      ? cssVar.colorSuccess
      : cssVar.colorTextSecondary;
  const title = stats.inProgress
    ? '进行中'
    : stats.completed === stats.total
      ? '全部完成'
      : '待办列表';

  return (
    <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
      <div className={toolRenderStyles.panelHeader}>
        <span className={toolRenderStyles.panelHeaderIcon}>
          <Icon icon={icon} size={15} style={{ color }} />
        </span>
        <span className={toolRenderStyles.panelHeaderTitle}>{title}</span>
        <span className={toolRenderStyles.panelBadge}>
          {stats.completed}/{stats.total}
        </span>
      </div>
      <div className={todoStyles.listBody}>
        {todos.map((item, index) => (
          <TodoRow index={index} item={item} key={`${item.content}-${index}`} />
        ))}
      </div>
    </Block>
  );
});
