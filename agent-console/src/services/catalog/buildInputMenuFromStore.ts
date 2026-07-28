import { mapAgentsTopicsToInputMenu } from '../../adapters/api/mappers/inputMenu';
import type { InputMenuData } from '../../domain/types/inputMenu';
import { filterTopicsForAgent } from '../../domain/topicAgentScope';
import { mapAgentFilesToMentionFiles } from '../../domain/utils/mentionMenuItems';
import { useAgentStore, useTopicStore, useWorkspaceStore } from '../../stores';

/** 用已加载的 agents / plusState / topics 组装 @ 菜单，切换 agent 时避免重复打 agent-runs。 */
export function buildInputMenuFromStore(agentId: string): InputMenuData | null {
  const agents = useAgentStore.getState().agents;
  if (!agents.length || !agentId) return null;

  const plusState = useAgentStore.getState().plusStateByAgentId[agentId];
  const topics = filterTopicsForAgent(useTopicStore.getState().topics, agentId);
  const previousFiles = useWorkspaceStore.getState().inputMenu.mentionFiles;
  const agentFiles = plusState
    ? mapAgentFilesToMentionFiles(plusState.files, { enabledOnly: true })
    : [];

  return mapAgentsTopicsToInputMenu(agents, topics, [...agentFiles, ...previousFiles]);
}
