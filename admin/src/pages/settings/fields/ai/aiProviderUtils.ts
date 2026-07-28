export type AIProviderType = 'OPENAI' | 'GLM' | 'CLAUDE' | 'GEMINI' | 'OLLAMA' | 'SMALL';

export const AI_PROVIDER_TYPE_META: Record<
  AIProviderType,
  { label: string; shortLabel: string; icon: string }
> = {
  OPENAI: { label: 'OpenAI Compatible', shortLabel: 'OpenAI', icon: 'smart_toy' },
  GLM: { label: '智谱 GLM', shortLabel: 'GLM', icon: 'psychology' },
  CLAUDE: { label: 'Anthropic Claude', shortLabel: 'Anthropic', icon: 'forum' },
  GEMINI: { label: 'Google Gemini', shortLabel: 'Gemini', icon: 'auto_awesome' },
  OLLAMA: { label: 'Ollama Local', shortLabel: 'Ollama', icon: 'terminal' },
  SMALL: { label: 'Small 小模型', shortLabel: 'Small', icon: 'memory' }
};

export type ProviderTestResult = {
  status: 'idle' | 'testing' | 'healthy' | 'error';
  message?: string;
  testedAt?: number;
};

export function extractHost(apiUrl?: string): string {
  if (!apiUrl) return '—';
  try {
    return new URL(apiUrl).host;
  } catch {
    return apiUrl.replace(/^https?:\/\//, '').split('/')[0] || apiUrl;
  }
}

export function getModelSummary(provider: { models?: string[] }): string {
  const count = provider.models?.length || 0;
  if (count === 0) return '未选择模型';
  if (count === 1) return provider.models![0];
  return `${provider.models![0]} 等 ${count} 个`;
}

export function getEndpointPath(apiEndpoint?: string): string {
  switch (apiEndpoint) {
    case 'passthrough':
      return '透传（使用接口地址）';
    case 'responses':
      return '/v1/responses';
    case 'messages':
      return '/v1/messages';
    case 'chat_completions':
    case 'auto':
    default:
      return '/v1/chat/completions';
  }
}

export const API_ENDPOINT_OPTIONS = [
  { value: 'chat_completions', label: '/v1/chat/completions' },
  { value: 'responses', label: '/v1/responses' },
  { value: 'messages', label: '/v1/messages' },
  { value: 'passthrough', label: '透传（使用接口地址）' },
] as const;

export type ApiEndpointValue = (typeof API_ENDPOINT_OPTIONS)[number]['value'];

export function getDefaultApiEndpoint(type?: string): ApiEndpointValue {
  return type === 'CLAUDE' ? 'messages' : 'chat_completions';
}

export function normalizeApiEndpoint(apiEndpoint?: string, providerType?: string): ApiEndpointValue {
  if (apiEndpoint === 'passthrough') return 'passthrough';
  if (apiEndpoint === 'responses') return 'responses';
  if (apiEndpoint === 'messages') return 'messages';
  if (apiEndpoint === 'chat_completions') return 'chat_completions';
  return getDefaultApiEndpoint(providerType);
}

export function getEndpointLabel(apiEndpoint?: string): string {
  return getEndpointPath(apiEndpoint);
}

export function maskApiKeyDisplay(provider: {
  apiKey?: string;
  apiKeyConfigured?: boolean;
}): string {
  const key = provider.apiKey || '';
  if (key && key.length > 8) {
    return `${key.slice(0, 3)}****${key.slice(-4)}`;
  }
  if (provider.apiKeyConfigured) return 'sk-****';
  return '未配置';
}

export function getPrimaryModel(provider: { models?: string[]; name?: string }): string {
  if (provider.models?.length) return provider.models[0];
  return provider.name || '未指定模型';
}

export const REASONING_EFFORT_OPTIONS = [
  { value: 'none', label: '默认' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '极高' }
] as const;

export function getProviderDisplayName(provider: {
  name?: string;
  models?: string[];
  id?: string;
}): string {
  return provider.name?.trim() || provider.models?.[0] || provider.id || '未命名';
}

export const AI_PROVIDER_TYPE_ORDER: AIProviderType[] = [
  'OPENAI',
  'GLM',
  'CLAUDE',
  'GEMINI',
  'OLLAMA',
  'SMALL'
];

export function listProviderTypesInUse(providers: any[]): AIProviderType[] {
  return AI_PROVIDER_TYPE_ORDER.filter((type) =>
    providers.some((p) => p.type === type && (p.models?.length || 0) > 0)
  );
}

export function listConfigsByType(providers: any[], type: string): any[] {
  return providers.filter((p) => p.type === type && (p.models?.length || 0) > 0);
}

export function getProviderTypeLabel(type?: string): string {
  if (!type) return '未选择';
  const meta = AI_PROVIDER_TYPE_META[type as AIProviderType];
  return meta?.shortLabel || type;
}

export function isProviderMultimodalEnabled(provider: {
  models?: string[];
  modelCapabilities?: Record<string, string[]>;
}): boolean {
  const model = provider.models?.[0];
  if (!model) return false;
  const capabilities = provider.modelCapabilities?.[model];
  return Array.isArray(capabilities) && capabilities.includes('vision');
}

export function setProviderMultimodalEnabled<T extends { models?: string[]; modelCapabilities?: Record<string, string[]> }>(
  provider: T,
  enabled: boolean,
): T {
  const model = provider.models?.[0];
  if (!model) return provider;

  const modelCapabilities = { ...(provider.modelCapabilities || {}) };
  if (enabled) {
    modelCapabilities[model] = ['vision'];
  } else {
    delete modelCapabilities[model];
  }

  const hasCapabilities = Object.keys(modelCapabilities).length > 0;
  return {
    ...provider,
    modelCapabilities: hasCapabilities ? modelCapabilities : undefined,
  };
}

export function applyPrimaryModelId<T extends { models?: string[]; modelCapabilities?: Record<string, string[]> }>(
  provider: T,
  modelId: string,
): T {
  const previousModel = provider.models?.[0];
  const nextModel = modelId.trim();
  const enabled = isProviderMultimodalEnabled(provider);
  const modelCapabilities = { ...(provider.modelCapabilities || {}) };

  if (previousModel && previousModel !== nextModel) {
    delete modelCapabilities[previousModel];
  }

  if (enabled && nextModel) {
    modelCapabilities[nextModel] = ['vision'];
  }

  const hasCapabilities = Object.keys(modelCapabilities).length > 0;
  return {
    ...provider,
    models: nextModel ? [nextModel] : [],
    modelCapabilities: hasCapabilities ? modelCapabilities : undefined,
  };
}

export function normalizeProviderModelCapabilities(provider: {
  models?: string[];
  modelCapabilities?: Record<string, string[]>;
}): Record<string, string[]> | undefined {
  const model = provider.models?.[0];
  if (!model || !isProviderMultimodalEnabled(provider)) return undefined;
  return { [model]: ['vision'] };
}

export function createEmptyAIProviderDraft(type: AIProviderType = 'OPENAI') {
  const id = `ai-${Math.random().toString(36).substr(2, 5)}`;
  return {
    id,
    name: '',
    type,
    apiUrl:
      type === 'GLM'
        ? 'https://open.bigmodel.cn/api/paas/v4'
        : type === 'OPENAI'
          ? 'https://api.openai.com'
          : type === 'CLAUDE'
            ? 'https://api.anthropic.com'
            : type === 'GEMINI'
              ? 'https://generativelanguage.googleapis.com'
              : 'http://localhost:11434',
    apiKey: '',
    models: [],
    enabled: true,
    useProxy: false,
    apiEndpoint: type === 'CLAUDE' ? ('messages' as const) : ('chat_completions' as const),
    reasoningEffort: 'none' as const
  };
}
