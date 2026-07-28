import { ActionIcon, Block, Checkbox, Flexbox, Icon, Input, SortableList } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { CircleArrowRight, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useState, type ChangeEvent } from 'react';

import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';

interface TodoItem {
  id: string;
  status: 'todo' | 'done' | 'processing';
  text: string;
}

const rowStyles = createStaticStyles(({ css, cssVar }) => ({
  deleteIcon: css`
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.2s;
  `,
  dragHandle: css`
    flex-shrink: 0;
    width: 16px !important;
    opacity: 0;
    transition: opacity 0.2s;
  `,
  itemRow: css`
    width: 100%;
    min-width: 0;
    max-width: 100%;
    padding-block: 10px;
    padding-inline: 4px 12px;
    border-block-end: 1px dashed ${cssVar.colorBorderSecondary};

    &:hover {
      .drag-handle,
      .delete-icon {
        opacity: 1;
      }
    }
  `,
  textCompleted: css`
    color: ${cssVar.colorTextQuaternary};
    text-decoration: line-through;
  `,
  textProcessing: css`
    color: ${cssVar.colorWarningText};
  `,
}));

function normalizeItems(args: BuiltinInterventionProps['args']): TodoItem[] {
  const saved = Array.isArray(args.items)
    ? (args.items as Array<{ status?: string; text?: string }>)
    : null;
  if (saved?.length) {
    return saved.map((item, index) => ({
      id: `todo-${index}`,
      status:
        item.status === 'done' || item.status === 'completed'
          ? 'done'
          : item.status === 'processing'
            ? 'processing'
            : 'todo',
      text: item.text ?? '',
    }));
  }
  const adds = Array.isArray(args.adds) ? (args.adds as string[]) : [];
  return adds.map((text, index) => ({ id: `todo-${index}`, status: 'todo' as const, text }));
}

const TodoRow = memo(function TodoRow({
  item,
  items,
  persist,
  placeholder,
}: {
  item: TodoItem;
  items: TodoItem[];
  persist: (next: TodoItem[]) => void | Promise<void>;
  placeholder: string;
}) {
  const isCompleted = item.status === 'done';
  const isProcessing = item.status === 'processing';

  return (
    <Flexbox horizontal align="center" className={rowStyles.itemRow} gap={4} width="100%">
      <SortableList.DragHandle className={cx(rowStyles.dragHandle, 'drag-handle')} size="small" />
      {isProcessing ? (
        <Icon
          icon={CircleArrowRight}
          size={16}
          style={{ color: cssVar.colorInfo, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => {
            void persist(
              items.map((row) =>
                row.id === item.id ? { ...row, status: 'todo' as const } : row,
              ),
            );
          }}
        />
      ) : (
        <Checkbox
          backgroundColor={cssVar.colorSuccess}
          checked={isCompleted}
          shape="circle"
          style={{ borderWidth: 1.5 }}
          onChange={() => {
            void persist(
              items.map((row) => {
                if (row.id !== item.id) return row;
                if (row.status === 'done') return { ...row, status: 'todo' as const };
                return { ...row, status: 'done' as const };
              }),
            );
          }}
        />
      )}
      <Input
        className={cx(isCompleted && rowStyles.textCompleted, isProcessing && rowStyles.textProcessing)}
        placeholder={placeholder}
        size="small"
        style={{ flex: 1, minWidth: 0 }}
        value={item.text}
        variant="borderless"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          void persist(items.map((row) => (row.id === item.id ? { ...row, text: e.target.value } : row)));
        }}
      />
      <ActionIcon
        className={cx(rowStyles.deleteIcon, 'delete-icon')}
        icon={Trash2}
        size="small"
        tabIndex={-1}
        onClick={() => void persist(items.filter((row) => row.id !== item.id))}
      />
    </Flexbox>
  );
});

export const CreateTodosIntervention = memo(function CreateTodosIntervention({
  args,
  onArgsChange,
  registerBeforeApprove,
}: BuiltinInterventionProps) {
  const [items, setItems] = useState<TodoItem[]>(() => normalizeItems(args));

  const persist = useCallback(
    async (next: TodoItem[]) => {
      setItems(next);
      await onArgsChange?.({
        items: next.map(({ status, text }) => ({
          status: status === 'done' ? 'completed' : status,
          text,
        })),
      });
    },
    [onArgsChange],
  );

  useEffect(() => {
    if (!registerBeforeApprove) return;
    return registerBeforeApprove('sortable-todo-list', async () => {
      await onArgsChange?.({
        items: items.map(({ status, text }) => ({
          status: status === 'done' ? 'completed' : status,
          text,
        })),
      });
    });
  }, [items, onArgsChange, registerBeforeApprove]);

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="批准前可拖拽排序、勾选完成或编辑条目。"
        title="待办列表"
      >
        <div className={interventionStyles.metaRow}>
          <span className={interventionStyles.metaChip}>{items.length} 项</span>
        </div>
      </InterventionSection>
      <InterventionPanel padded={false}>
        <Block variant="borderless">
          <SortableList
            gap={0}
            items={items}
            renderItem={(item) => (
              <SortableList.Item id={item.id} key={item.id} style={{ padding: 0 }}>
                <TodoRow item={item} items={items} persist={persist} placeholder="添加待办…" />
              </SortableList.Item>
            )}
            onChange={(sorted) => {
              void persist(sorted as TodoItem[]);
            }}
          />
        </Block>
      </InterventionPanel>
    </Flexbox>
  );
});
