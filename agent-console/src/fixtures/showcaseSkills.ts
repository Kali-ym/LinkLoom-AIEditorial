/** @deprecated Use `domain/types/actionTag` */
export type {
  ActionTagCategory,
  ActionTagPayload,
  TAG_CATEGORY_LABEL,
  TAG_CATEGORY_TIP,
} from '../domain/types/actionTag';

export const SKILL_TAG_DEMOS: import('../domain/types/actionTag').ActionTagPayload[] = [
  { category: 'command', label: 'compact', type: 'compact' },
  { category: 'command', label: 'newTopic', type: 'newTopic' },
  { category: 'skill', label: '网页读取', type: 'linkloom-skills-web-browsing' },
  { category: 'agentSkill', label: 'LinkLoom 接入', type: 'agent-doc-linkloom' },
  { category: 'projectSkill', label: 'frontend-design', type: 'proj-fe' },
  { category: 'tool', label: 'web-browsing', type: 'web-browsing' },
];

export const SKILL_SHOWCASE_TITLE =
  '技能调用示例（ActionTag 胶囊：命令 / 技能 / 工具）';

export const SKILL_SHOWCASE_HINT =
  '行首 / 插入命令与技能；@ 提及技能与工具。悬停查看 tooltip，点击选中描边。';
