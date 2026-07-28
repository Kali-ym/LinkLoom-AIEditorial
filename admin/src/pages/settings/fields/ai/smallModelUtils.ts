export const SMALL_MODEL_BACKENDS = ['OPENAI_COMPAT', 'OLLAMA', 'JINA', 'COHERE', 'LOCAL_HTTP'] as const;

export type SmallModelRole = 'EMBEDDING' | 'RERANK';

export type SmallModelService = {
  id: string;
  name: string;
  role: SmallModelRole;
  backend: string;
  apiUrl: string;
  apiKey?: string;
  apiKeyConfigured?: boolean;
  model: string;
  dimensions?: number;
  enabled: boolean;
  useProxy: boolean;
};

export type SmallModelTestResult = {
  status: 'idle' | 'testing' | 'healthy' | 'error';
  message?: string;
  testedAt?: number;
};

export const SMALL_MODEL_ROLE_META: Record<
  SmallModelRole,
  { label: string; shortLabel: string; icon: string; hint: string }
> = {
  EMBEDDING: {
    label: 'Embedding 向量',
    shortLabel: 'Embedding',
    icon: 'data_array',
    hint: '用于向量索引与语义召回'
  },
  RERANK: {
    label: 'Rerank 精排',
    shortLabel: 'Rerank',
    icon: 'sort',
    hint: '用于召回后的结果精排'
  }
};

export function createEmptySmallModelDraft(role: SmallModelRole = 'EMBEDDING'): SmallModelService {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `rag-${role.toLowerCase()}-${suffix}`,
    name: role === 'EMBEDDING' ? '新 Embedding 服务' : '新 Rerank 服务',
    role,
    backend: role === 'EMBEDDING' ? 'OPENAI_COMPAT' : 'JINA',
    apiUrl: '',
    apiKey: '',
    model: '',
    dimensions: role === 'EMBEDDING' ? 1024 : undefined,
    enabled: true,
    useProxy: false
  };
}

export function getSmallModelDisplayName(service: SmallModelService): string {
  return service.name?.trim() || service.model || service.id;
}

export function maskSmallModelApiKey(service: {
  apiKey?: string;
  apiKeyConfigured?: boolean;
}): string {
  const key = service.apiKey || '';
  if (key && key.length > 8) return `${key.slice(0, 3)}****${key.slice(-4)}`;
  if (service.apiKeyConfigured) return 'sk-****';
  return '未配置';
}
