import { getAgentConsolePorts, isAgentConsoleApiMode } from '../../adapters/registry';
import { prepareTopicsForAgentSwitch, refreshTopicsForAgent } from '../../hooks/data/invalidate';
import { buildInputMenuFromStore } from '../catalog/buildInputMenuFromStore';
import { useAgentStore, useTopicStore, useWorkspaceStore } from '../../stores';

/** 确保目标 agent 的工具/技能权限（plusState）已加载。 */
async function ensureAgentPlusState(agentId: string): Promise<void> {
  if (!agentId || !isAgentConsoleApiMode()) return;
  if (useAgentStore.getState().plusStateByAgentId[agentId]) return;

  try {
    const plusState = await getAgentConsolePorts().agent.getPlusState(agentId);
    if (useAgentStore.getState().activeAgentId !== agentId) return;
    useAgentStore.setState((state) => ({
      plusStateByAgentId: { ...state.plusStateByAgentId, [agentId]: plusState },
    }));
    refreshInputMenuFromStore(agentId);
  } catch (error) {
    console.error('[agentConsole] load agent plus state failed', error);
  }
}

function refreshInputMenuFromStore(agentId: string): void {
  const menu = buildInputMenuFromStore(agentId);
  if (menu) {
    useWorkspaceStore.getState().setInputMenu(menu);
  }
}

let switchGeneration = 0;

async function revalidateAfterAgentSwitch(agentId: string, generation: number): Promise<void> {
  try {
    const tasks: Array<Promise<void>> = [
      refreshTopicsForAgent(agentId, { skipTempFallback: true }),
    ];
    if (!useAgentStore.getState().plusStateByAgentId[agentId]) {
      tasks.push(ensureAgentPlusState(agentId));
    }
    await Promise.all(tasks);

    if (generation !== switchGeneration) return;

    refreshInputMenuFromStore(agentId);

    const workspaceDocs = useWorkspaceStore.getState().documentsByAgentId;
    if (!(agentId in workspaceDocs)) {
      void useWorkspaceStore.getState().refreshWorkspaceDocuments(agentId);
    }
  } finally {
    if (generation === switchGeneration) {
      useTopicStore.setState({ isRevalidating: false });
    }
  }
}

/**
 * 同步乐观切换：立刻更新侧栏 / 标题 / 输入区，网络刷新在后台进行。
 */
export function startAgentSwitch(agentId: string): void {
  if (!agentId) return;

  const previousAgentId = useAgentStore.getState().activeAgentId;
  if (previousAgentId === agentId) return;

  const generation = ++switchGeneration;

  prepareTopicsForAgentSwitch(previousAgentId, agentId);
  useAgentStore.getState().setActiveAgentId(agentId);
  useAgentStore.getState().finishConfigLoad();
  refreshInputMenuFromStore(agentId);

  void revalidateAfterAgentSwitch(agentId, generation);
}

/** @deprecated 优先使用 startAgentSwitch；保留供少数需要 await 的调用方。 */
export async function switchAgentContext(agentId: string): Promise<void> {
  startAgentSwitch(agentId);
}
