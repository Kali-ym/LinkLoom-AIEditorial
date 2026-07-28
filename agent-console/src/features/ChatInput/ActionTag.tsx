import { Tooltip } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Sparkles, Terminal, Wrench } from 'lucide-react';
import { memo } from 'react';

import {
  TAG_CATEGORY_LABEL,
  TAG_CATEGORY_TIP,
  type ActionTagPayload,
} from '../../domain/types/actionTag';
import { actionTagStyles } from '../shared/editor';

const categoryClass: Record<ActionTagPayload['category'], string> = {
  skill: actionTagStyles.skillTag,
  agentSkill: actionTagStyles.agentSkillTag,
  projectSkill: actionTagStyles.projectSkillTag,
  tool: actionTagStyles.toolTag,
  command: actionTagStyles.commandTag,
  file: actionTagStyles.fileTag,
};

function tagIcon(category: ActionTagPayload['category']) {
  if (category === 'command') return Terminal;
  if (category === 'tool') return Wrench;
  return Sparkles;
}

/** §C.4 ActionTag*/
export const ActionTag = memo(function ActionTag({
  payload,
  selected,
  onSelect,
}: {
  payload: ActionTagPayload;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const Icon = tagIcon(payload.category);
  const tooltip = (
    <>
      <strong>{payload.label}</strong>
      <br />
      {TAG_CATEGORY_LABEL[payload.category]}
      <br />
      {TAG_CATEGORY_TIP[payload.category]}
    </>
  );

  return (
    <Tooltip title={tooltip}>
      <span
        className={cx(
          actionTagStyles.actionTag,
          categoryClass[payload.category],
          selected && 'selected',
        )}
        data-category={payload.category}
        data-type={payload.type}
        data-label={payload.label}
        tabIndex={-1}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect?.();
        }}
      >
        <span className={actionTagStyles.actionTagIcon}>
          <Icon size={14} />
        </span>
        <span>{payload.label}</span>
      </span>
    </Tooltip>
  );
});
