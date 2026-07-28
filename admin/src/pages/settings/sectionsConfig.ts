export type SettingsTab = { id: string; label: string; icon: string };

export type SettingsSection = {
  id: string;
  tab: string;
  title: string;
  description: string;
  fields: Array<{ label: string; key: string; type: string } & Record<string, unknown>>;
};

export function buildTabs(pluginMetadata: {
  aiProviders: unknown[];
  adapters: unknown[];
  publishers: unknown[];
  storages: unknown[];
}): SettingsTab[] {
  return [
    ...(pluginMetadata.aiProviders.length > 0
      ? [{ id: 'ai', label: 'AI 模型', icon: 'psychology' }]
      : []),
    ...(pluginMetadata.adapters.length > 0
      ? [{ id: 'sources', label: '数据源管理', icon: 'database' }]
      : []),
    { id: 'categories', label: '分类管理', icon: 'label' },
    ...(pluginMetadata.publishers.length > 0 || pluginMetadata.storages.length > 0
      ? [{ id: 'publishers', label: '发布与存储', icon: 'send' }]
      : []),
    { id: 'interop', label: 'AI 互联', icon: 'hub' },
    { id: 'system', label: '系统', icon: 'settings' }
  ];
}

export function buildSections(settings: Record<string, unknown>): SettingsSection[] {
  return [
    {
      id: 'interop',
      tab: 'interop',
      title: 'AI 互联管理',
      description: '管理已授权的其他 AI 系统接入。在此可以撤销已生成的 API Key。',
      fields: [{ label: '互联 API Key 列表', key: 'INTEROP_KEYS', type: 'custom' }]
    },
    {
      id: 'ai',
      tab: 'ai',
      title: 'AI 模型配置',
      description: '配置大模型提供商与 RAG 小模型（Embedding / Rerank）连接；生效服务在运维中心 RAG 面板选择',
      fields: [
        {
          label: '生效 AI 提供商',
          key: 'ACTIVE_AI_PROVIDER_ID',
          type: 'select',
          options: ((settings.AI_PROVIDERS as any[]) || [])
            .filter((p: any) => !((settings.CLOSED_PLUGINS as string[]) || []).includes(p.id))
            .map((p: any) => ({ label: p.name, value: p.id })),
          defaultValue: 'default-gemini'
        },
        { label: 'AI 提供商列表', key: 'AI_PROVIDERS', type: 'custom' }
      ]
    },
    {
      id: 'publishers',
      tab: 'publishers',
      title: '发布与存储管理',
      description: '配置内容分发平台及图片/视频存储插件',
      fields: [
        { label: '发布渠道列表', key: 'PUBLISHERS', type: 'custom' },
        { label: '存储插件配置', key: 'STORAGES', type: 'custom' }
      ]
    },
    {
      id: 'sources',
      tab: 'sources',
      title: '数据源管理',
      description: '管理数据适配器及其子数据源项',
      fields: [{ label: '适配器配置', key: 'ADAPTERS', type: 'custom' }]
    },
    {
      id: 'categories',
      tab: 'categories',
      title: '分类标签管理',
      description: '管理全局分类标签，用于数据源归类',
      fields: [{ label: '分类配置', key: 'CATEGORIES', type: 'custom' }]
    },
    {
      id: 'network',
      tab: 'system',
      title: '网络与代理设置',
      description: '配置接口代理与图片代理，解决访问限制问题',
      fields: [
        {
          label: 'API 接口代理',
          key: 'API_PROXY',
          type: 'text',
          placeholder: '例如: https://proxy.example.com:7890'
        },
        {
          label: '图片代理模板',
          key: 'IMAGE_PROXY',
          type: 'text',
          placeholder: '例如: https://i0.wp.com/{url} 或 /api/proxy/image?url={url}'
        }
      ]
    },
    {
      id: 'editorial',
      tab: 'system',
      title: '日报编辑',
      description:
        '配置 AI 日报流水线的去重与跨日入库。要闻条数 / 合并来源数请在日报工作流模板变量中调整。',
      fields: [
        {
          label: '标题去重相似度阈值',
          key: 'EDITORIAL_CONFIG.titleDedupThreshold',
          type: 'number',
          defaultValue: 0.92,
          placeholder: '0.5～1，默认 0.92'
        },
        {
          label: '默认编辑模式',
          key: 'EDITORIAL_CONFIG.defaultEditorialMode',
          type: 'select',
          options: [
            { label: '标准（过滤低相关）', value: 'standard' },
            { label: '保守（保留低相关）', value: 'conservative' }
          ],
          defaultValue: 'standard'
        },
        {
          label: '跨日回溯天数',
          key: 'EDITORIAL_CONFIG.crossDayLookbackDays',
          type: 'number',
          defaultValue: 7,
          placeholder: '1～30'
        },
        {
          label: '跨日 URL 硬去重',
          key: 'EDITORIAL_CONFIG.crossDayUrlHardDrop',
          type: 'select',
          options: [
            { label: '是', value: true },
            { label: '否（仅提示）', value: false }
          ],
          defaultValue: true
        },
        {
          label: '跨日标题相似度阈值',
          key: 'EDITORIAL_CONFIG.crossDayTitleSimilarityThreshold',
          type: 'number',
          defaultValue: 0.88,
          placeholder: '0.5～1'
        },
        {
          label: '发布时写入长期记忆',
          key: 'EDITORIAL_CONFIG.ingestToMemoryOnPublish',
          type: 'select',
          options: [
            { label: '是', value: true },
            { label: '否', value: false }
          ],
          defaultValue: false
        },
        {
          label: '发布时写入知识库',
          key: 'EDITORIAL_CONFIG.ingestToKnowledgeOnPublish',
          type: 'select',
          options: [
            { label: '是', value: true },
            { label: '否', value: false }
          ],
          defaultValue: true
        },
        {
          label: '知识库分类名',
          key: 'EDITORIAL_CONFIG.knowledgeCategoryName',
          type: 'text',
          defaultValue: 'AI资讯日报',
          placeholder: 'AI资讯日报'
        },
        {
          label: '长期记忆分类名',
          key: 'EDITORIAL_CONFIG.memoryCategoryName',
          type: 'text',
          defaultValue: '日报跨日索引',
          placeholder: '日报跨日索引'
        }
      ]
    },
    {
      id: 'hot-merge',
      tab: 'system',
      title: '热搜合并',
      description:
        '配置今日热搜事件成团策略。规则合并用摘要/实体打分；语义合并用 Embedding；混合为默认（规则后再对候选对做语义二判）。',
      fields: [
        {
          label: '合并模式',
          key: 'HOT_CONFIG.mergeMode',
          type: 'select',
          options: [
            { label: '混合（规则 + 语义候选）', value: 'hybrid' },
            { label: '仅规则', value: 'rules' },
            { label: '仅语义（Embedding）', value: 'semantic' }
          ],
          defaultValue: 'hybrid'
        },
        {
          label: '热搜 Embedding 服务',
          key: 'HOT_CONFIG.embeddingServiceId',
          type: 'select',
          options: [
            { label: '使用全局 ACTIVE Embedding', value: '' },
            ...((settings.SMALL_MODEL_SERVICES as any[]) || [])
              .filter((s: any) => s?.role === 'EMBEDDING' && s?.enabled !== false)
              .map((s: any) => ({
                label: `${s.name || s.id} (${s.model || 'model'})`,
                value: s.id
              }))
          ],
          defaultValue: ''
        },
        {
          label: '语义相似度阈值',
          key: 'HOT_CONFIG.similarityMin',
          type: 'number',
          defaultValue: 0.78,
          placeholder: '0.5～0.99，默认 0.78'
        }
      ]
    },
    {
      id: 'selection',
      tab: 'system',
      title: '采集聚合',
      description:
        '供采集任务聚合与 Agent 工具 get_aggregated_content 使用；内容筛选页自身用 URL 日期范围，不读这两项。',
      fields: [
        {
          label: '聚合回溯天数',
          key: 'SELECTION_FETCH_DAYS',
          type: 'number',
          defaultValue: 2,
          placeholder: '从选定日期起回溯的天数'
        },
        {
          label: '聚合查询字段',
          key: 'SELECTION_QUERY_FIELD',
          type: 'select',
          options: [
            { label: '抓取日期 (ingestion_date)', value: 'ingestion_date' },
            { label: '发布日期 (published_date)', value: 'published_date' }
          ],
          defaultValue: 'published_date'
        }
      ]
    },
    {
      id: 'security',
      tab: 'system',
      title: '安全与访问',
      description: '管理系统访问密码与登录会话过期时间',
      fields: [
        {
          label: '系统访问密码',
          key: 'SYSTEM_PASSWORD',
          type: 'password',
          placeholder: '在此设置新的系统密码'
        },
        {
          label: '登录过期时间',
          key: 'AUTH_EXPIRE_TIME',
          type: 'text',
          placeholder: '例如: 7d, 24h, 1h'
        }
      ]
    }
  ];
}
