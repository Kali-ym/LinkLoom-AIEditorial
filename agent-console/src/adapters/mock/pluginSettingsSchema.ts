import type { ToolPayload } from '../../domain/types/tool';

type JsonSchemaObject = Record<string, unknown>;

/** §C.26 — mock plugin manifest settings（对齐 `getPluginSettingsSchema` 子集） */
export const PLUGIN_SETTINGS_SCHEMA_MOCKS: Record<string, JsonSchemaObject> = {
  'web-browsing': {
    properties: {
      maxPages: { description: '最大抓取页数', type: 'number' },
      userAgent: { description: '自定义 User-Agent', type: 'string' },
    },
    type: 'object',
  },
  'linkloom-web-browsing': {
    properties: {
      maxPages: { description: '最大抓取页数', type: 'number' },
      userAgent: { description: '自定义 User-Agent', type: 'string' },
    },
    type: 'object',
  },
  'linkloom-sandbox': {
    properties: {
      timeout: { description: '执行超时（秒）', type: 'number' },
      networkAccess: { description: '允许网络访问', type: 'boolean' },
    },
    type: 'object',
  },
  'linkloom-artifacts': {
    properties: {
      autoSave: { description: '自动保存产物', type: 'boolean' },
      defaultFormat: {
        description: '默认导出格式',
        enum: ['markdown', 'html', 'pdf'],
        type: 'string',
      },
    },
    type: 'object',
  },
  'linkloom-activator': {
    properties: {
      strictMatch: { description: '严格匹配工具名', type: 'boolean' },
    },
    type: 'object',
  },
  'linkloom-local-system': {
    properties: {
      workingDirectory: { description: '工作目录', type: 'string' },
      allowWrite: { description: '允许写入文件', type: 'boolean' },
    },
    type: 'object',
  },
  'claude-code': {
    properties: {
      maxTurns: { description: '最大回合数', type: 'number' },
    },
    type: 'object',
  },
  'linkloom-delivery-checker': {
    properties: {
      failOnWarning: { description: '警告视为失败', type: 'boolean' },
    },
    type: 'object',
  },
  'linkloom-agent': {
    properties: {
      planMode: {
        description: '规划模式',
        enum: ['auto', 'manual'],
        type: 'string',
      },
    },
    type: 'object',
  },
  'linkloom-cloud-sandbox': {
    properties: {
      region: { description: '沙箱区域', type: 'string' },
      memoryMb: { description: '内存上限（MB）', type: 'number' },
    },
    type: 'object',
  },
  'linkloom-user-interaction': {
    properties: {
      defaultTimeout: { description: '等待用户响应超时（秒）', type: 'number' },
    },
    type: 'object',
  },
  'linkloom-web-onboarding': {
    properties: {
      showTour: { description: '显示引导 tour', type: 'boolean' },
    },
    type: 'object',
  },
  'linkloom-agent-builder': {
    properties: {
      templateId: { description: '默认模板 ID', type: 'string' },
    },
    type: 'object',
  },
  'linkloom-group-management': {
    properties: {
      maxMembers: { description: '最大成员数', type: 'number' },
    },
    type: 'object',
  },
  'linkloom-user-memory': {
    properties: {
      retentionDays: { description: '记忆保留天数', type: 'number' },
    },
    type: 'object',
  },
  'linkloom-agent-documents': {
    properties: {
      indexOnUpload: { description: '上传后自动索引', type: 'boolean' },
    },
    type: 'object',
  },
  'linkloom-page-agent': {
    properties: {
      embedMode: {
        description: '嵌入模式',
        enum: ['iframe', 'shadow'],
        type: 'string',
      },
    },
    type: 'object',
  },
  mcp: {
    properties: {
      serverUrl: { description: 'MCP 服务地址', type: 'string' },
      timeout: { description: '调用超时（秒）', type: 'number' },
    },
    type: 'object',
  },
};

const PLUGIN_ID_ALIASES: Record<string, string> = {
  'linkloom-web-browsing': 'web-browsing',
};

export function resolvePluginId(tool: Pick<ToolPayload, 'plugin' | 'identifier'>): string | undefined {
  return tool.plugin ?? tool.identifier;
}

export function resolvePluginSettingsSchema(
  pluginId: string | undefined,
): JsonSchemaObject | undefined {
  if (!pluginId) return undefined;
  const canonical = PLUGIN_ID_ALIASES[pluginId] ?? pluginId;
  if (PLUGIN_SETTINGS_SCHEMA_MOCKS[canonical]) return PLUGIN_SETTINGS_SCHEMA_MOCKS[canonical];
  if (pluginId.startsWith('mcp:')) return PLUGIN_SETTINGS_SCHEMA_MOCKS.mcp;
  return undefined;
}

export function enrichToolPayload(tool: ToolPayload): ToolPayload {
  if (tool.settingsSchema && Object.keys(tool.settingsSchema).length > 0) {
    return tool;
  }
  const schema = resolvePluginSettingsSchema(resolvePluginId(tool));
  return schema ? { ...tool, settingsSchema: schema } : tool;
}

export function enrichToolPayloads(tools: ToolPayload[]): ToolPayload[] {
  return tools.map(enrichToolPayload);
}
