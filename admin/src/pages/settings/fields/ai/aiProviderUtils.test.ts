import { describe, expect, it } from 'vitest';

import {
  applyPrimaryModelId,
  isProviderMultimodalEnabled,
  normalizeProviderModelCapabilities,
  setProviderMultimodalEnabled,
} from './aiProviderUtils';

describe('aiProviderUtils multimodal', () => {
  it('toggles modelCapabilities vision for the primary model', () => {
    const provider = { models: ['gpt-5.5'], modelCapabilities: undefined as Record<string, string[]> | undefined };
    const enabled = setProviderMultimodalEnabled(provider, true);
    expect(isProviderMultimodalEnabled(enabled)).toBe(true);
    expect(enabled.modelCapabilities).toEqual({ 'gpt-5.5': ['vision'] });

    const disabled = setProviderMultimodalEnabled(enabled, false);
    expect(isProviderMultimodalEnabled(disabled)).toBe(false);
    expect(disabled.modelCapabilities).toBeUndefined();
  });

  it('moves vision capability when the primary model id changes', () => {
    const provider = setProviderMultimodalEnabled(
      { models: ['gpt-4o'] } as { models: string[]; modelCapabilities?: Record<string, string[]> },
      true,
    );
    const next = applyPrimaryModelId(provider, 'gpt-5.5');
    expect(next.modelCapabilities).toEqual({ 'gpt-5.5': ['vision'] });
    expect(next.modelCapabilities?.['gpt-4o']).toBeUndefined();
  });

  it('normalizes saved capabilities to the current primary model only', () => {
    expect(
      normalizeProviderModelCapabilities({
        models: ['gpt-5.5'],
        modelCapabilities: { 'gpt-5.5': ['vision'], 'legacy-model': ['vision'] },
      }),
    ).toEqual({ 'gpt-5.5': ['vision'] });
  });
});
