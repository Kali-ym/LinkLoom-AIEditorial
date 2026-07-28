import type { EnabledProviderWithModels } from '../domain/types/aiModel';

/** §C.42 mock*/
export const MOCK_ENABLED_CHAT_MODELS: EnabledProviderWithModels[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    source: 'builtin',
    children: [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindowTokens: 128_000,
        maxOutput: 16_384,
        abilities: { functionCall: true, vision: true, imageOutput: true },
      },
      {
        id: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindowTokens: 128_000,
        maxOutput: 16_384,
        abilities: { functionCall: true, vision: true, imageOutput: true },
      },
    ],
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    source: 'custom',
    children: [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindowTokens: 128_000,
        abilities: { functionCall: true, vision: true, imageOutput: true },
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    source: 'builtin',
    children: [
      {
        id: 'claude-sonnet-4',
        displayName: 'Claude Sonnet 4',
        contextWindowTokens: 200_000,
        abilities: { functionCall: true, vision: true },
      },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    source: 'builtin',
    children: [
      {
        id: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindowTokens: 1_000_000,
        abilities: { functionCall: true, vision: true, imageOutput: true },
      },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    source: 'custom',
    children: [
      {
        id: 'llama3.2',
        displayName: 'Llama 3.2',
        contextWindowTokens: 128_000,
        abilities: {},
      },
    ],
  },
];
