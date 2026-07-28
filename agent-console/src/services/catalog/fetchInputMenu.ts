import { getAgentConsolePorts } from '../../adapters/registry';
import type { InputMenuData } from '../../domain/types';

export async function fetchInputMenu(agentId: string): Promise<InputMenuData> {
  return getAgentConsolePorts().catalog.getInputMenu(agentId);
}
