import { Block, Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { CheckCircle2, Circle, ListTodo, PencilLine, RotateCcw } from 'lucide-react';
import { memo } from 'react';

import { toolRenderStyles } from '../../shared/toolRenderStyles';
import type { TodoPanelItem, TodoUpdateItem } from './todoPanelNormalize';

export type { TodoUpdateItem } from './todoPanelNormalize';

const updateStyles = createStaticStyles(({ css, cssVar }) => ({
  listBody: css`
    padding-block: 4px;
  `,
  row: css`
    display: flex;
    gap: 10px;
    align-items: flex-start;
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
  iconWrap: css`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-block-start: 1px;
    border-radius: 6px;
    background: color-mix(in srgb, ${cssVar.colorFillTertiary} 80%, ${cssVar.colorBgContainer});
  `,
  main: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  `,
  title: css`
    font-size: 13px;
    font-weight: 500;
    line-height: 1.45;
    color: ${cssVar.colorText};
    word-break: break-word;
  `,
  meta: css`
    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextSecondary};
    word-break: break-word;
  `,
  idTag: css`
    display: inline-flex;
    flex-shrink: 0;
    align-self: flex-start;
    padding-block: 2px;
    padding-inline: 7px;
    border-radius: 6px;
    font-family: ${cssVar.fontFamilyCode};
    font-size: 10px;
    font-weight: 500;
    line-height: 1.35;
    color: ${cssVar.colorTextTertiary};
    background: ${cssVar.colorFillTertiary};
  `,
  changeChip: css`
    flex-shrink: 0;
    align-self: flex-start;
    padding-block: 2px;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.35;
  `,
  chipDone: css`
    color: ${cssVar.colorSuccessText};
    background: ${cssVar.colorSuccessBg};
  `,
  chipReopen: css`
    color: ${cssVar.colorWarningText};
    background: ${cssVar.colorWarningBg};
  `,
  chipEdit: css`
    color: ${cssVar.colorInfoText};
    background: ${cssVar.colorInfoBg};
  `,
}));

function changeMeta(update: TodoUpdateItem) {
  if (update.content !== undefined && update.completed !== undefined) {
    return {
      chip: updateStyles.chipEdit,
      detail: `内容 → ${update.content}`,
      icon: PencilLine,
      iconColor: cssVar.colorInfo,
      label: '更新内容与状态',
    };
  }
  if (update.completed === true) {
    return {
      chip: updateStyles.chipDone,
      detail: undefined,
      icon: CheckCircle2,
      iconColor: cssVar.colorSuccess,
      label: '标记完成',
    };
  }
  if (update.completed === false) {
    return {
      chip: updateStyles.chipReopen,
      detail: undefined,
      icon: RotateCcw,
      iconColor: cssVar.colorWarning,
      label: '重新打开',
    };
  }
  if (update.content !== undefined) {
    return {
      chip: updateStyles.chipEdit,
      detail: `内容 → ${update.content}`,
      icon: PencilLine,
      iconColor: cssVar.colorInfo,
      label: '更新内容',
    };
  }
  return {
    chip: updateStyles.chipEdit,
    detail: undefined,
    icon: Circle,
    iconColor: cssVar.colorTextSecondary,
    label: '更新',
  };
}

const UpdateRow = memo(function UpdateRow({ update }: { update: TodoUpdateItem }) {
  const meta = changeMeta(update);
  const title = update.label?.trim() || `待办 #${update.id}`;

  return (
    <div className={updateStyles.row}>
      <span className={updateStyles.iconWrap}>
        <Icon icon={meta.icon} size={14} style={{ color: meta.iconColor }} />
      </span>
      <div className={updateStyles.main}>
        <span className={updateStyles.title}>{title}</span>
        {meta.detail ? <span className={updateStyles.meta}>{meta.detail}</span> : null}
      </div>
      <span className={updateStyles.idTag}>#{update.id}</span>
      <span className={cx(updateStyles.changeChip, meta.chip)}>{meta.label}</span>
    </div>
  );
});

export const TodoUpdatePanel = memo(function TodoUpdatePanel({
  resultTodos,
  summary,
  updates,
}: {
  resultTodos?: TodoPanelItem[];
  summary?: string;
  updates: TodoUpdateItem[];
}) {
  if (!updates.length) return null;

  const completedCount = resultTodos?.filter((item) => item.status === 'completed').length;

  return (
    <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
      <div className={toolRenderStyles.panelHeader}>
        <span className={toolRenderStyles.panelHeaderIcon}>
          <Icon icon={ListTodo} size={15} />
        </span>
        <span className={toolRenderStyles.panelHeaderTitle}>{summary?.trim() || '待办更新'}</span>
        <span className={toolRenderStyles.panelBadge}>
          {updates.length} 项变更
          {resultTodos?.length
            ? ` · ${completedCount ?? 0}/${resultTodos.length}`
            : ''}
        </span>
      </div>
      <div className={updateStyles.listBody}>
        {updates.map((update) => (
          <UpdateRow key={update.id} update={update} />
        ))}
      </div>
    </Block>
  );
});
