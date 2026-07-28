import type { TopicModelSelection } from '../../domain/agentConsoleScope';
import { useAgentStore } from '../../stores/agentStore';
import { useTopicStore } from '../../stores/topicStore';
import { readStoredTopicModel } from './topicModelStorage';

function normalizeSelection(selection: TopicModelSelection): TopicModelSelection | null {
  const model = selection.model?.trim();
  const provider = selection.provider?.trim();
  if (!model || !provider) return null;
  return { model, provider };
}

/** In-memory override, else localStorage — never agent default. */
export function resolveTopicModelOverride(topicId: string): TopicModelSelection | null {
  if (!topicId) return null;
  const inMemory = useTopicStore.getState().modelByTopicId[topicId];
  if (inMemory) return inMemory;
  return readStoredTopicModel(topicId);
}

/** Topic override when present, otherwise the active agent default. */
export function resolveTopicEffectiveModel(topicId: string): TopicModelSelection {
  ensureTopicModelLoaded(topicId);
  const override = resolveTopicModelOverride(topicId);
  if (override) return override;
  const agentDefault = useAgentStore.getState().getActivePlusState();
  return {
    model: agentDefault.model,
    provider: agentDefault.provider,
  };
}

/** Hydrate `modelByTopicId` from localStorage when the topic has a saved selection. */
export function ensureTopicModelLoaded(topicId: string): void {
  if (!topicId) return;
  const state = useTopicStore.getState();
  if (state.modelByTopicId[topicId]) return;
  const stored = readStoredTopicModel(topicId);
  if (!stored) return;
  useTopicStore.setState((s) => ({
    modelByTopicId: { ...s.modelByTopicId, [topicId]: stored },
  }));
}

/** Write topic model to memory + localStorage (UI switch or send-time sync). */
export function persistTopicModelSelection(
  topicId: string,
  selection: TopicModelSelection,
): void {
  if (!topicId) return;
  const normalized = normalizeSelection(selection);
  if (!normalized) return;
  useTopicStore.getState().setTopicModelProvider(topicId, normalized);
}

/**
 * Persist the model that will be used for the next run — including mid-conversation
 * switches from the model picker.
 */
export function persistTopicModelForSend(topicId: string): void {
  if (!topicId) return;
  const selection = normalizeSelection(resolveTopicEffectiveModel(topicId));
  if (!selection) return;
  persistTopicModelSelection(topicId, selection);
}

/** @deprecated Use {@link persistTopicModelForSend} */
export function ensureTopicModelBound(topicId: string): void {
  persistTopicModelForSend(topicId);
}
