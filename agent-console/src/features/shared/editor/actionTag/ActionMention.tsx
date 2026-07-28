import { Tooltip } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Sparkles, Terminal, Wrench } from 'lucide-react';
import { memo } from 'react';

import {
  TAG_CATEGORY_LABEL,
  TAG_CATEGORY_TIP,
  type ActionTagCategory,
} from '../../../../domain/types/actionTag';
import { actionTagStyles } from '../actionTagStyles';

const categoryClass: Record<ActionTagCategory, string> = {
  skill: actionTagStyles.skillTag,
  agentSkill: actionTagStyles.agentSkillTag,
  projectSkill: actionTagStyles.projectSkillTag,
  tool: actionTagStyles.toolTag,
  command: actionTagStyles.commandTag,
  file: actionTagStyles.fileTag,
};

function tagIcon(category: ActionTagCategory) {
  if (category === 'command') return Terminal;
  if (category === 'tool') return Wrench;
  return Sparkles;
}

/** Read-only inline chip*/
export const ActionMention = memo(function ActionMention({
  category,
  label,
}: {
  category: ActionTagCategory;
  label: string;
}) {
  const Icon = tagIcon(category);

  return (
    <Tooltip
      title={
        <>
          <strong>{label}</strong>
          <br />
          {TAG_CATEGORY_LABEL[category]}
          <br />
          {TAG_CATEGORY_TIP[category]}
        </>
      }
    >
      <span className={cx(actionTagStyles.actionTag, categoryClass[category])}>
        <span className={actionTagStyles.actionTagIcon}>
          <Icon size={14} />
        </span>
        <span>{label}</span>
      </span>
    </Tooltip>
  );
});
