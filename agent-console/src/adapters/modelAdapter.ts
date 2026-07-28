import type { AiModelForSelect, EnabledProviderWithModels } from '../domain/types/aiModel';
import { MOCK_ENABLED_CHAT_MODELS } from '../fixtures/enabledChatModels';
import { findMockModel } from '../fixtures/modelCatalog';

/** §C.42 — mock enabled list；未来替换为 aiInfra API */
export function getEnabledChatModels(): EnabledProviderWithModels[] {
  return MOCK_ENABLED_CHAT_MODELS;
}

export function findEnabledModel(
  modelId: string,
  providerId: string,
  list: EnabledProviderWithModels[] = getEnabledChatModels(),
): AiModelForSelect | undefined {
  const provider = list.find((p) => p.id === providerId);
  return provider?.children.find((m) => m.id === modelId);
}

/** 与后端 AgentGovernanceManager 一致：空 model 时取提供商 models[0]。 */
export function resolveAgentModelSelection(
  modelId: string | undefined,
  providerId: string | undefined,
  list: EnabledProviderWithModels[],
): { model: string; provider: string } {
  const trimmedProvider = providerId?.trim() || '';
  const trimmedModel = modelId?.trim() || '';

  if (trimmedProvider) {
    const provider = list.find((entry) => entry.id === trimmedProvider);
    if (provider) {
      if (trimmedModel && provider.children.some((child) => child.id === trimmedModel)) {
        return { model: trimmedModel, provider: trimmedProvider };
      }
      const firstModel = provider.children[0]?.id;
      if (firstModel) {
        return { model: firstModel, provider: trimmedProvider };
      }
    }
  }

  if (trimmedModel && trimmedProvider) {
    return { model: trimmedModel, provider: trimmedProvider };
  }

  const fallbackProvider = list[0];
  const fallbackModel = fallbackProvider?.children[0]?.id || '';
  return {
    model: fallbackModel || trimmedModel,
    provider: fallbackProvider?.id || trimmedProvider,
  };
}

export function getModelDisplayName(modelId: string, providerId: string): string {
  return (
    findEnabledModel(modelId, providerId)?.displayName ??
    findMockModel(modelId, providerId)?.label ??
    modelId
  );
}

export function isModelImageOutput(modelId: string, providerId: string): boolean {
  return (
    findEnabledModel(modelId, providerId)?.abilities.imageOutput ??
    findMockModel(modelId, providerId)?.abilities.imageOutput ??
    false
  );
}