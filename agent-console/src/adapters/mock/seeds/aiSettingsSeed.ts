import type { AiSettingsSnapshot } from '../../aiProviderSettings';

/** Mock `/api/settings` AI fields for Agent Console dev mode. */
export function getMockAiSettings(): AiSettingsSnapshot {
  return {
    ACTIVE_AI_PROVIDER_ID: 'openai',
    AI_PROVIDERS: [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'OPENAI',
        apiUrl: 'https://api.openai.com',
        apiKeyConfigured: true,
        models: ['gpt-4o', 'gpt-4o-mini'],
        enabled: true,
        useProxy: false,
        apiEndpoint: 'chat_completions',
        reasoningEffort: 'medium',
        modelCapabilities: {
          'gpt-4o': ['vision'],
          'gpt-4o-mini': ['vision'],
        },
      },
      {
        id: 'azure',
        name: 'Azure OpenAI',
        type: 'OPENAI',
        apiUrl: 'https://your-resource.openai.azure.com',
        apiKeyConfigured: true,
        models: ['gpt-4o'],
        enabled: true,
        useProxy: false,
        apiEndpoint: 'chat_completions',
        modelCapabilities: { 'gpt-4o': ['vision'] },
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'CLAUDE',
        apiUrl: 'https://api.anthropic.com',
        apiKeyConfigured: true,
        models: ['claude-sonnet-4'],
        enabled: true,
        useProxy: false,
        apiEndpoint: 'messages',
        reasoningEffort: 'high',
        modelCapabilities: { 'claude-sonnet-4': ['vision'] },
      },
      {
        id: 'google',
        name: 'Google',
        type: 'GEMINI',
        apiUrl: 'https://generativelanguage.googleapis.com',
        apiKeyConfigured: true,
        models: ['gemini-2.0-flash'],
        enabled: true,
        useProxy: false,
        modelCapabilities: { 'gemini-2.0-flash': ['vision'] },
      },
      {
        id: 'ollama',
        name: 'Ollama',
        type: 'OLLAMA',
        apiUrl: 'http://localhost:11434',
        apiKeyConfigured: false,
        models: ['llama3.2'],
        enabled: true,
        useProxy: false,
      },
    ],
  };
}
