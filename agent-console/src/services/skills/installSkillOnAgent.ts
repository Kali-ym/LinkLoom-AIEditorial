import { getAgentConsolePorts, isAgentConsoleApiMode } from '../../adapters/registry';
import { showToast } from '../ui/toast';
import { useAgentStore } from '../../stores/agentStore';

export async function installSkillOnAgent(
  agentId: string,
  skillId: string,
  skillName: string,
): Promise<void> {
  if (isAgentConsoleApiMode()) {
    await getAgentConsolePorts().agent.installSkill(agentId, skillId);
  }
  useAgentStore.getState().togglePlugin(skillId, true);
  showToast(`已安装技能：${skillName}`);
}
