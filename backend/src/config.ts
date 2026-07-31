import { SystemSettings } from './types/config.js';

export const defaultSettings: SystemSettings = {
  ACTIVE_AI_PROVIDER_ID: 'default-gemini',
  ACTIVE_EMBEDDING_SERVICE_ID: '',
  ACTIVE_RERANK_SERVICE_ID: '',
  SMALL_MODEL_SERVICES: [
    {
      id: 'default-ollama-embed',
      name: 'Ollama Embedding (bge-m3)',
      role: 'EMBEDDING',
      backend: 'OLLAMA',
      apiUrl: 'http://localhost:11434',
      model: 'bge-m3',
      dimensions: 1024,
      enabled: false,
      useProxy: false
    }
  ],
  RAG_CONFIG: {
    hybridEnabled: false,
    ftsWeight: 0.5,
    vectorWeight: 0.5,
    retrievalTopK: 20,
    rerankEnabled: false,
    rerankTopK: 5,
    mmrEnabled: true,
    mmrLambda: 0.7,
    queryRewriteEnabled: false,
    queryExpansionMaxQueries: 5,
    embedOnIngest: true,
    reindexOnServiceChange: false,
    embeddingBatchSize: 16,
    embeddingConcurrency: 1,
    embeddingMaxAttempts: 3,
    plannerMaxCategories: 3,
    plannerMaxDocuments: 8,
    minVectorCoverageForHybrid: 0.8,
    jsonbVectorFallbackEnabled: true,
    chunkStrategy: 'structure',
    chunkSize: 3000,
    chunkOverlap: 400,
    semanticMaxChunkSize: 3000,
    semanticMinChunkSize: 200,
    semanticBreakpointPercentile: 85,
    synthesisAgentId: '',
    plannerAgentId: ''
  },
  PROVIDER_GOVERNANCE: {
    enabled: false
  },
  AGENT_RUN_CONFIG: {},
  AI_PROVIDERS: [
    {
      id: 'default-gemini',
      name: 'Google Gemini',
      type: 'GEMINI',
      apiUrl: 'https://generativelanguage.googleapis.com',
      apiKey: '',
      models: ['gemini-3-flash-preview'],
      enabled: true,
      useProxy: false
    },
    {
      id: 'default-claude',
      name: 'Anthropic Claude',
      type: 'CLAUDE',
      apiUrl: 'https://api.anthropic.com',
      apiKey: '',
      models: ['claude-opus-4-6'],
      enabled: true,
      useProxy: false,
      apiEndpoint: 'messages'
    },
    {
      id: 'default-openai',
      name: 'OpenAI',
      type: 'OPENAI',
      apiUrl: 'https://api.openai.com',
      apiKey: '',
      models: ['gpt-5.3'],
      enabled: true,
      useProxy: false,
      apiEndpoint: 'auto'
    },
    {
      id: 'default-glm',
      name: '智谱 GLM',
      type: 'GLM',
      apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: '',
      models: ['glm-4-flash'],
      enabled: true,
      useProxy: false,
      apiEndpoint: 'auto'
    },
    {
      id: 'default-ollama',
      name: 'Ollama',
      type: 'OLLAMA',
      apiUrl: 'http://localhost:11434',
      apiKey: '',
      models: ['llama3'],
      enabled: true,
      useProxy: false
    }
  ],

  PUBLISHERS: [
    {
      id: 'local_site',
      enabled: true,
      config: {
        baseURL: 'http://localhost:3000/',
        buildAfterPublish: false
      }
    },
    {
      id: 'github',
      enabled: false,
      config: {
        token: '',
        repo: '',
        branch: 'main'
      }
    },
    {
      id: 'wechat',
      enabled: false,
      config: {
        appId: '',
        appSecret: '',
        title: '',
        author: ''
      }
    },
    {
      id: 'rss',
      enabled: false,
      config: {
        title: '',
        description: '',
        siteUrl: '',
        feedUrl: ''
      }
    }
  ],

  STORAGES: [
    {
      id: 'github',
      enabled: false,
      config: {
        token: '',
        repo: '',
        branch: 'main',
        pathPrefix: 'images'
      }
    },
    {
      id: 'r2',
      enabled: false,
      config: {
        accountId: '',
        accessKeyId: '',
        secretAccessKey: '',
        bucketName: '',
        publicUrlPrefix: ''
      }
    }
  ],

  SYSTEM_PASSWORD: '',
  AUTH_EXPIRE_TIME: '7d',

  API_PROXY: '',
  IMAGE_PROXY: '',

  ADAPTERS: [
    {
      id: 'follow-api',
      name: 'Follow API (Folo)',
      adapterType: 'FollowApiAdapter',
      enabled: true,
      apiUrl: 'https://api.follow.is/entries',
      fetchDays: 3,
      foloCookie: '',
      items: []
    },
    {
      id: 'ai-search',
      name: 'AI 搜索',
      adapterType: 'AISearchAdapter',
      enabled: true,
      apiUrl: '',
      items: []
    },
    {
      id: 'rss-adapter',
      name: 'RSS 订阅',
      adapterType: 'RSSAdapter',
      enabled: true,
      apiUrl: '',
      items: []
    }
  ],
  CLOSED_PLUGINS: ['GitHubTrendingAdapter'],

  CATEGORIES: [{ id: 'rss', label: 'RSS 订阅', icon: 'rss_feed' }],
  SELECTION_FETCH_DAYS: 2,
  SELECTION_QUERY_FIELD: 'published_date',
  EDITORIAL_CONFIG: {
    titleDedupThreshold: 0.92,
    defaultEditorialMode: 'standard',
    sourceTierOverrides: {},
    crossDayLookbackDays: 7,
    crossDayUrlHardDrop: true,
    crossDayTitleSimilarityThreshold: 0.88,
    ingestToMemoryOnPublish: false,
    ingestToKnowledgeOnPublish: true,
    knowledgeCategoryName: 'AI资讯日报',
    memoryCategoryName: '日报跨日索引'
  },
  HOT_CONFIG: {
    mergeMode: 'semantic',
    embeddingServiceId: '',
    similarityMin: 0.78,
    llmProviderId: '',
    llmModelId: '',
    llmMaxJudgmentsPerRun: 50,
    llmCacheTtlMinutes: 360
  }
};
