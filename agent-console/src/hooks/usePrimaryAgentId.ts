import { useAgentListStore } from '../stores';

/** 当前主智能体 id（布局 inboxAgentId，来自 API / mock 解析）。 */
export function usePrimaryAgentId(): string {
  return useAgentListStore((s) => s.inboxAgentId);
}
