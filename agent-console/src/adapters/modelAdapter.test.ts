import { describe, expect, it } from 'vitest';

import type { EnabledProviderWithModels } from '../domain/types/aiModel';
import { resolveAgentModelSelection } from './modelAdapter';

const catalog: EnabledProviderWithModels[] = [
  {
    id: 'default-gemini',
    name: 'Google Gemini',
    source: 'custom',
    children: [{ id: 'gemini-3-flash-preview', displayName: 'Gemini Flash', abilities: {} }],
  },
  {
    id: 'default-openai',
    name: 'OpenAI',
    source: 'custom',
    children: [{ id: 'gpt-4o', displayName: 'GPT-4o', abilities: {} }],
  },
];

describe('resolveAgentModelSelection', () => {
  it('uses provider first model when agent model is empty', () => {
    expect(resolveAgentModelSelection('', 'default-gemini', catalog)).toEqual({
      model: 'gemini-3-flash-preview',
      provider: 'default-gemini',
    });
  });

  it('keeps explicit model when it exists on provider', () => {
    expect(resolveAgentModelSelection('gpt-4o', 'default-openai', catalog)).toEqual({
      model: 'gpt-4o',
      provider: 'default-openai',
    });
  });

  it('falls back to first catalog provider when both are empty', () => {
    expect(resolveAgentModelSelection('', '', catalog)).toEqual({
      model: 'gemini-3-flash-preview',
      provider: 'default-gemini',
    });
  });
});
