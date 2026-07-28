/** 与后端 maskSettingsForResponse / merge 规则对齐 */
export function isMaskedSecret(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value === '********') return true;
  if (value.includes('...')) return true;
  return /^.{1,8}\.\.\..{1,8}$/.test(value);
}

/** 已保存密钥在表单中的展示占位（非真实密钥，勿提交后端） */
export const SAVED_API_KEY_DISPLAY = '••••••••••••••••';

export function isSavedApiKeyDisplay(value: unknown): boolean {
  return typeof value === 'string' && /^•+$/.test(value);
}

/** 表单不展示脱敏串，用 apiKeyConfigured 标记已保存 */
export function sanitizeAiProvidersForForm(providers: any[]): any[] {
  return (providers || []).map((p) => {
    const masked = isMaskedSecret(p?.apiKey);
    const hadKey = Boolean(p?.apiKey) && !masked && !isSavedApiKeyDisplay(p?.apiKey);
    return {
      ...p,
      apiKey: masked || isSavedApiKeyDisplay(p?.apiKey) ? '' : p?.apiKey || '',
      apiKeyConfigured: hadKey || masked || Boolean(p?.apiKeyConfigured)
    };
  });
}

export function sanitizeSmallModelServicesForForm(services: any[]): any[] {
  return (services || []).map((svc) => {
    const masked = isMaskedSecret(svc?.apiKey);
    const hadKey = Boolean(svc?.apiKey) && !masked && !isSavedApiKeyDisplay(svc?.apiKey);
    return {
      ...svc,
      apiKey: masked || isSavedApiKeyDisplay(svc?.apiKey) ? '' : svc?.apiKey || '',
      apiKeyConfigured: hadKey || masked || Boolean(svc?.apiKeyConfigured)
    };
  });
}

export function getApiKeyInputValue(provider: {
  apiKey?: string;
  apiKeyConfigured?: boolean;
}): string {
  if (provider.apiKey) return provider.apiKey;
  if (provider.apiKeyConfigured) return SAVED_API_KEY_DISPLAY;
  return '';
}

import { normalizeProviderModelCapabilities } from '../pages/settings/fields/ai/aiProviderUtils';

/** 提交保存前去掉展示用掩码，保留 UI 字段外的数据 */
export function prepareSettingsForSave(settings: Record<string, unknown>): Record<string, unknown> {
  const providers = (settings.AI_PROVIDERS as any[]) || [];
  const smallModelServices = (settings.SMALL_MODEL_SERVICES as any[]) || [];
  return {
    ...settings,
    AI_PROVIDERS: providers.map((p) => {
      const { apiKeyConfigured: _c, ...rest } = p;
      const key = typeof rest.apiKey === 'string' ? rest.apiKey : '';
      const modelCapabilities = normalizeProviderModelCapabilities(rest);
      return {
        ...rest,
        apiKey: isSavedApiKeyDisplay(key) ? '' : key,
        modelCapabilities,
      };
    }),
    SMALL_MODEL_SERVICES: smallModelServices.map((svc) => {
      const { apiKeyConfigured: _c, ...rest } = svc;
      const key = typeof rest.apiKey === 'string' ? rest.apiKey : '';
      return {
        ...rest,
        apiKey: isSavedApiKeyDisplay(key) ? '' : key
      };
    })
  };
}
