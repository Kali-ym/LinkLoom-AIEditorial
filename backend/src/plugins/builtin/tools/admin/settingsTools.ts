import {
  requireToolContext,
  type ToolExecutionContext,
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import { DashboardRouteService } from '../../../../services/api/DashboardRouteService.js';
import { SettingsRouteService } from '../../../../services/api/SettingsRouteService.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };
const HIGH: ToolExecutionPolicy = { readonly: false, riskLevel: 'high' };

function maskKeyForMessage(key: string): string {
  if (key.length > 12) return `${key.slice(0, 8)}...${key.slice(-4)}`;
  return '********';
}

class GetSettingsTool extends BaseTool {
  readonly id = 'get_settings';
  readonly name = 'get_settings';
  readonly displayName = '查系统设置';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly description =
    '读取当前系统设置(密钥等敏感字段已脱敏)。用户要查看平台配置时调用。';
  readonly parameters = { type: 'object', properties: {} };

  async handler(_args: Record<string, never>, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new SettingsRouteService(store, services);
      const settings = service.getSettings();
      return { ok: true, settings };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'GET_SETTINGS_FAILED',
        message,
        hint: '可在 /settings 页面查看系统设置',
      };
    }
  }
}

class UpdateSettingsTool extends BaseTool {
  readonly id = 'update_settings';
  readonly name = 'update_settings';
  readonly displayName = '更新系统设置';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = HIGH;
  readonly description =
    '以 patch 语义更新系统设置(部分键合并)。必填 patch 对象。' +
    '修改前应先调 get_settings 查看当前值并确认变更范围。';
  readonly parameters = {
    type: 'object',
    properties: {
      patch: {
        type: 'object',
        description: '要更新的设置字段(部分键,深度合并)',
        additionalProperties: true,
      },
    },
    required: ['patch'],
  };

  async handler(args: { patch: Record<string, unknown> }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new SettingsRouteService(store, services);
      const result = await service.saveSettings(args.patch);
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'UPDATE_SETTINGS_FAILED',
        message,
        hint: '可在 /settings 页面手动修改',
      };
    }
  }
}

class TestAiProviderTool extends BaseTool {
  readonly id = 'test_ai_provider';
  readonly name = 'test_ai_provider';
  readonly displayName = '测试 AI 提供商';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '测试 AI 提供商连接。提供 providerConfig(完整配置对象)或 providerId(从当前设置查找)。' +
    '使用 providerId 时先调 get_settings 确认提供商存在。';
  readonly parameters = {
    type: 'object',
    properties: {
      providerConfig: {
        type: 'object',
        description: 'AI 提供商配置对象(id/type/apiKey/model 等)',
        additionalProperties: true,
      },
      providerId: { type: 'string', description: '已保存的 AI 提供商 id(与 providerConfig 二选一)' },
    },
  };

  async handler(
    args: { providerConfig?: Record<string, unknown>; providerId?: string },
    toolCtx?: ToolExecutionContext,
  ) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      let config = args.providerConfig;
      if (!config && args.providerId) {
        const settingsService = new SettingsRouteService(store, services);
        const settings = settingsService.getSettings() as {
          AI_PROVIDERS?: Array<{ id: string }>;
        };
        const provider = (settings.AI_PROVIDERS || []).find((p) => p.id === args.providerId);
        if (!provider) {
          return {
            ok: false,
            errorCode: 'NOT_FOUND',
            message: `AI provider ${args.providerId} not found`,
            hint: '调 get_settings 查看 AI_PROVIDERS 列表',
          };
        }
        config = provider as Record<string, unknown>;
      }
      if (!config) {
        return {
          ok: false,
          errorCode: 'INVALID_INPUT',
          message: 'providerConfig or providerId is required',
          hint: '提供 providerConfig 或 providerId',
        };
      }
      const service = new DashboardRouteService(services);
      const result = await service.testProvider(config);
      return { ok: true, providerId: config.id ?? args.providerId, result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'TEST_AI_PROVIDER_FAILED',
        message,
        hint: '可在 /settings 页面测试 AI 连接',
      };
    }
  }
}

class CreateApiKeyTool extends BaseTool {
  readonly id = 'create_api_key';
  readonly name = 'create_api_key';
  readonly displayName = '创建 API Key';
  readonly scope = 'agent' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '创建新的平台 API Key。必填 name(密钥名称)。密钥仅返回一次,请提醒用户立即保存。';
  readonly parameters = {
    type: 'object',
    properties: { name: { type: 'string', description: 'API Key 名称/用途说明' } },
    required: ['name'],
  };

  async handler(args: { name: string }, toolCtx?: ToolExecutionContext) {
    const { store, services } = requireToolContext(toolCtx, this.id);
    try {
      const service = new SettingsRouteService(store, services);
      const created = await service.createApiKey(false, args.name);
      const masked = maskKeyForMessage(created.key);
      return {
        ok: true,
        id: created.id,
        name: args.name,
        key: created.key,
        message: `API Key 已创建(仅显示一次): ${masked}。请立即复制保存,之后无法再次查看完整密钥。`,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'CREATE_API_KEY_FAILED',
        message,
        hint: '可在 /settings 页面创建 API Key',
      };
    }
  }
}

export const settingsTools: BaseTool[] = [
  new GetSettingsTool(),
  new UpdateSettingsTool(),
  new TestAiProviderTool(),
  new CreateApiKeyTool(),
];
