import type { AgentChatConfig, AgentPlusState } from '../../domain/types/agentChatConfig';
import type { TopicModelSelection } from '../../domain/agentConsoleScope';

/**
 * Whether the reasoning UI should consume reasoning_part stream events.
 * Mirrors the backend reasoning gate (enableReasoning / thinking).
 */
export function isReasoningUiEnabled(chatConfig: AgentChatConfig | undefined): boolean {
  if (!chatConfig) return false;
  return (
    Boolean(chatConfig.enableReasoning) ||
    Boolean(chatConfig.enableReasoningEffort) ||
    chatConfig.thinking === 'enabled'
  );
}

/** True once bootstrap has loaded per-agent plus state (not FALLBACK_PLUS_STATE). */
export function hasHydratedPlusState(
  agentId: string,
  plusStateByAgentId: Record<string, AgentPlusState>,
): boolean {
  return Boolean(plusStateByAgentId[agentId]);
}

/**
 * Whether incoming reasoning_part events should update the UI.
 * Before plus state hydrates, do not gate — backend may still stream reasoning from the
 * agent's saved config while metadata is omitted.
 */
export function shouldConsumeReasoningStream(
  agentId: string,
  plusStateByAgentId: Record<string, AgentPlusState>,
  chatConfig: AgentChatConfig | undefined,
): boolean {
  if (!hasHydratedPlusState(agentId, plusStateByAgentId)) return true;
  return isReasoningUiEnabled(chatConfig);
}

/**
 * Runtime metadata for /api/agent-runs.
 * Omit until plus state is hydrated so `enableReasoning: false` defaults never override
 * the agent's saved chatConfig on the backend merge path.
 */
export function buildAgentRunConsoleMetadata(
  agentId: string,
  plusState: AgentPlusState,
  plusStateByAgentId: Record<string, AgentPlusState>,
  topicModel?: TopicModelSelection,
): { agentConsole: Pick<AgentPlusState, 'chatConfig' | 'params'> & Partial<TopicModelSelection> } | undefined {
  if (!hasHydratedPlusState(agentId, plusStateByAgentId)) return undefined;

  const agentDefault = { model: plusState.model, provider: plusState.provider };
  const runtimeModel =
    topicModel &&
    (topicModel.model !== agentDefault.model || topicModel.provider !== agentDefault.provider)
      ? topicModel
      : undefined;

  return {
    agentConsole: {
      chatConfig: plusState.chatConfig,
      params: plusState.params,
      ...(runtimeModel ?? {}),
    },
  };
}
