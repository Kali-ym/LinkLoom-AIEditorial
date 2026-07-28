import type { Agent } from '../services/agentService';

export type AgentCategoryBindingField =
  | 'knowledgeCategoryIds'
  | 'knowledgeSaveCategoryIds'
  | 'memoryCategoryIds'
  | 'memorySaveCategoryIds';

export interface AgentToolCategoryConfig {
  title: string;
  description: string;
  field: AgentCategoryBindingField;
  categoryType: 'knowledge' | 'memory';
}

/** 需要在启用工具时弹窗选择分类的智能体工具 */
export const AGENT_TOOL_CATEGORY_CONFIG: Record<string, AgentToolCategoryConfig> = {
  query_knowledge: {
    title: '关联检索知识库',
    description: '选择智能体检索知识库时可查阅的分类，可多选。',
    field: 'knowledgeCategoryIds',
    categoryType: 'knowledge'
  },
  save_knowledge: {
    title: '关联保存知识库',
    description: '选择允许写入的知识库分类，可多选；未指定分类时默认使用第一项。',
    field: 'knowledgeSaveCategoryIds',
    categoryType: 'knowledge'
  },
  query_memory: {
    title: '关联检索记忆',
    description: '选择智能体检索长期记忆时可查阅的主题分类，可多选。',
    field: 'memoryCategoryIds',
    categoryType: 'memory'
  },
  save_memory: {
    title: '关联保存记忆',
    description: '选择允许写入的记忆主题分类，可多选；未指定分类时默认使用第一项。',
    field: 'memorySaveCategoryIds',
    categoryType: 'memory'
  }
};

export function agentToolNeedsCategoryPicker(toolId: string): boolean {
  return toolId in AGENT_TOOL_CATEGORY_CONFIG;
}

export function getAgentCategoryBindingIds(agent: Agent, toolId: string): string[] {
  const cfg = AGENT_TOOL_CATEGORY_CONFIG[toolId];
  if (!cfg) return [];
  return (agent[cfg.field] as string[] | undefined) || [];
}

export function setAgentCategoryBindingIds(agent: Agent, toolId: string, ids: string[]): Agent {
  const cfg = AGENT_TOOL_CATEGORY_CONFIG[toolId];
  if (!cfg) return agent;
  return { ...agent, [cfg.field]: ids };
}

export function clearAgentCategoryBinding(agent: Agent, toolId: string): Agent {
  const cfg = AGENT_TOOL_CATEGORY_CONFIG[toolId];
  if (!cfg) return agent;
  return { ...agent, [cfg.field]: [] };
}
