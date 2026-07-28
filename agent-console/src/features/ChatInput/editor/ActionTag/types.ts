/** Action tag categories aligned with index.html `.action-tag` variants. */
export type ActionTagCategory =
  | 'command'
  | 'skill'
  | 'tool'
  | 'projectSkill'
  | 'agentSkill'
  | 'file';

export type ActionTagType = string;

export interface ActionTagData {
  category: ActionTagCategory;
  label: string;
  type: ActionTagType;
}

/** Built-in commands — line-start only, client-side execution. */
export const BUILTIN_COMMANDS: ActionTagData[] = [
  { category: 'command', label: 'newTopic', type: 'newTopic' },
  { category: 'command', label: 'compact', type: 'compact' },
];

/** zh-CN labels aligned with COMPONENT-INVENTORY §C.31 `editor:slash.*`. */
export const SLASH_COMMAND_LABELS: Record<string, string> = {
  compact: '压缩上下文',
  newTopic: '在新话题中发送',
};
