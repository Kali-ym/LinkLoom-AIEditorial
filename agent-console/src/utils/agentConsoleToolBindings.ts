import {
  AGENT_TOOL_CATEGORY_CONFIG,
  agentToolNeedsCategoryPicker,
} from './agentToolBindings';
import type { AgentPlusState } from '../domain/types/agentChatConfig';

export { agentToolNeedsCategoryPicker, AGENT_TOOL_CATEGORY_CONFIG };

export function getCategoryBindingIds(plus: AgentPlusState, toolId: string): string[] {
  const cfg = AGENT_TOOL_CATEGORY_CONFIG[toolId];
  if (!cfg) return [];
  return plus.categoryBindings[cfg.field] ?? [];
}

export function setCategoryBindingIds(
  plus: AgentPlusState,
  toolId: string,
  ids: string[],
): AgentPlusState {
  const cfg = AGENT_TOOL_CATEGORY_CONFIG[toolId];
  if (!cfg) return plus;
  return {
    ...plus,
    categoryBindings: {
      ...plus.categoryBindings,
      [cfg.field]: ids,
    },
  };
}

export function clearCategoryBinding(plus: AgentPlusState, toolId: string): AgentPlusState {
  return setCategoryBindingIds(plus, toolId, []);
}
