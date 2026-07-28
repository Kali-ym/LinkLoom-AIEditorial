/** Mock aiInfra model catalog — adapter 就绪后替换为 API 数据。 */
export interface MockModelEntry {
  id: string;
  provider: string;
  label: string;
  abilities: {
    imageOutput?: boolean;
    vision?: boolean;
  };
}

export const MOCK_MODEL_CATALOG: MockModelEntry[] = [
  { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', abilities: { imageOutput: true, vision: true } },
  { id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o Mini', abilities: { imageOutput: true, vision: true } },
  { id: 'claude-sonnet-4', provider: 'anthropic', label: 'Claude Sonnet 4', abilities: { vision: true } },
  { id: 'gemini-2.0-flash', provider: 'google', label: 'Gemini 2.0 Flash', abilities: { imageOutput: true, vision: true } },
  { id: 'llama3.2', provider: 'ollama', label: 'Llama 3.2', abilities: {} },
];

export function findMockModel(model: string, provider: string): MockModelEntry | undefined {
  return MOCK_MODEL_CATALOG.find((m) => m.id === model && m.provider === provider);
}

export function isMockModelImageOutput(model: string, provider: string): boolean {
  return findMockModel(model, provider)?.abilities.imageOutput ?? false;
}
