export type ActionTagCategory =
  | 'command'
  | 'skill'
  | 'tool'
  | 'projectSkill'
  | 'agentSkill'
  | 'file';

export interface ActionTagPayload {
  category: ActionTagCategory;
  label: string;
  type: string;
}

export const TAG_CATEGORY_LABEL: Record<ActionTagCategory, string> = {
  command: '命令',
  skill: '已安装技能',
  tool: '工具',
  projectSkill: '项目技能',
  agentSkill: 'Agent 技能',
  file: '文件',
};

export const TAG_CATEGORY_TIP: Record<ActionTagCategory, string> = {
  command: '行首命令，发送前在客户端执行',
  skill: '发送前预加载技能上下文',
  tool: '显式选择工具，注入调用上下文',
  projectSkill: '序列化为 /skill-name 由 CLI 解析',
  agentSkill: '从 Agent 文档库解析技能包',
  file: '附加到上下文的文件引用',
};
