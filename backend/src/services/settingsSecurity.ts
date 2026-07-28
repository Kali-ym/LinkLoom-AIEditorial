import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { SystemSettings } from '../types/config.js';

export const MASKED_SECRET = '********';

const SENSITIVE_KEY_PARTS = [
  'apiKey',
  'apikey',
  'token',
  'secret',
  'password',
  'key',
  'cookie',
  'foloCookie'
];

const TOP_LEVEL_OMIT_KEYS = new Set(['SYSTEM_PASSWORD', 'AI_BUILDER_POLICY_SECRET']);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part.toLowerCase()));
}

export function isMaskedSecret(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value === MASKED_SECRET) return true;
  if (value.includes('...')) return true;
  // 与 maskSecretValue 一致：sk-xxxx...yyyy
  return /^.{1,8}\.\.\..{1,8}$/.test(value);
}

function isSavedApiKeyDisplay(value: unknown): boolean {
  return typeof value === 'string' && /^•+$/.test(value);
}

/** 测试连接 / 拉模型：客户端常带脱敏 apiKey，从已存配置补全。 */
export function resolveProviderConfigForRuntime(
  config: Record<string, unknown> & { id?: string; apiKey?: string },
  settings: SystemSettings
): Record<string, unknown> & { id?: string; apiKey?: string } {
  const id = typeof config.id === 'string' ? config.id : '';
  if (!id) return config;
  const stored = (settings.AI_PROVIDERS || []).find((p) => p.id === id);
  if (!stored?.apiKey) return config;
  if (!config.apiKey || isMaskedSecret(config.apiKey) || isSavedApiKeyDisplay(config.apiKey)) {
    return { ...config, apiKey: stored.apiKey };
  }
  return config;
}

/** 小模型连通性测试：客户端常带空/脱敏 apiKey，从已存配置补全。 */
export function resolveSmallModelConfigForRuntime<
  T extends { id?: string; apiKey?: string }
>(config: T, settings: SystemSettings): T {
  const id = typeof config.id === 'string' ? config.id : '';
  if (!id) return config;
  const stored = (settings.SMALL_MODEL_SERVICES || []).find((svc) => svc.id === id);
  if (!stored?.apiKey) return config;
  if (!config.apiKey || isMaskedSecret(config.apiKey) || isSavedApiKeyDisplay(config.apiKey)) {
    return { ...config, apiKey: stored.apiKey };
  }
  return config;
}

function maskSecretValue(value: unknown): string {
  if (typeof value === 'string' && value.length > 8) {
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
  return MASKED_SECRET;
}

export function maskSettingsForResponse(settings: SystemSettings): SystemSettings {
  const maskSecrets = (value: unknown, keyName = ''): unknown => {
    if (Array.isArray(value)) return value.map((item) => maskSecrets(item));
    if (!value || typeof value !== 'object') {
      return keyName && isSensitiveKey(keyName) && value ? maskSecretValue(value) : value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value)) {
      if (TOP_LEVEL_OMIT_KEYS.has(key)) continue;
      result[key] = isSensitiveKey(key)
        ? maskSecretValue(childValue)
        : maskSecrets(childValue, key);
    }
    return result;
  };

  return maskSecrets(settings) as SystemSettings;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function isPasswordHash(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

export function verifyPassword(input: string, configured: string): boolean {
  if (!isPasswordHash(configured)) {
    return input === configured;
  }

  const [, salt, storedHash] = configured.split('$');
  if (!salt || !storedHash) return false;
  const inputHash = scryptSync(input, salt, 64);
  const stored = Buffer.from(storedHash, 'hex');
  return inputHash.length === stored.length && timingSafeEqual(inputHash, stored);
}

/** 管理端整表保存时，这些数组以客户端快照为准（允许删除项）。 */
export const SETTINGS_SNAPSHOT_ARRAY_KEYS = [
  'ADAPTERS',
  'AI_PROVIDERS',
  'CATEGORIES',
  'PUBLISHERS',
  'SMALL_MODEL_SERVICES',
  'STORAGES'
] as const;

type SnapshotArrayKey = (typeof SETTINGS_SNAPSHOT_ARRAY_KEYS)[number];

/** 用新列表覆盖旧列表（按 id 合并单项以保留脱敏密钥），未出现在新列表中的项会被删除。 */
export function replaceIdArraySnapshot(
  oldValue: unknown,
  newValue: unknown,
  parentKey = ''
): unknown[] {
  if (!Array.isArray(newValue)) return [];
  const oldArr = Array.isArray(oldValue) ? (oldValue as { id?: string }[]) : [];
  return newValue.map((newItem: any) => {
    if (!newItem || typeof newItem !== 'object' || !newItem.id) return newItem;
    const oldItem = oldArr.find((o) => o?.id === newItem.id);
    if (!oldItem) return newItem;
    const merged = mergeConfigValue(oldItem, newItem, parentKey) as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(newItem, 'items')) {
      merged.items = Array.isArray(newItem.items) ? newItem.items : [];
    }
    for (const [key, val] of Object.entries(newItem)) {
      if (isSensitiveKey(key) && isMaskedSecret(val)) {
        merged[key] = (oldItem as Record<string, unknown>)[key];
      }
    }
    return merged;
  });
}

function assignSnapshotArray<K extends SnapshotArrayKey>(
  result: SystemSettings,
  key: K,
  value: SystemSettings[K]
): void {
  result[key] = value;
}

export function applyAuthoritativeArraySnapshots(
  currentSettings: SystemSettings,
  newSettings: Partial<SystemSettings>,
  merged: SystemSettings
): SystemSettings {
  const result = { ...merged };
  for (const key of SETTINGS_SNAPSHOT_ARRAY_KEYS) {
    if (!Array.isArray(newSettings[key])) continue;
    assignSnapshotArray(
      result,
      key,
      replaceIdArraySnapshot(
        currentSettings[key],
        newSettings[key],
        key
      ) as SystemSettings[typeof key]
    );
  }
  return result;
}

function mergeConfigValue(oldValue: unknown, newValue: unknown, keyName = ''): unknown {
  if (newValue === undefined) return oldValue;
  if (newValue === null) return null;

  if (keyName === 'SYSTEM_PASSWORD') {
    if (typeof newValue !== 'string' || !newValue.trim() || isMaskedSecret(newValue)) {
      return oldValue;
    }
    return isPasswordHash(newValue) ? newValue : hashPassword(newValue);
  }

  if (isSensitiveKey(keyName) && (isMaskedSecret(newValue) || newValue === '')) {
    return oldValue;
  }

  if (Array.isArray(newValue)) {
    // 适配器子项列表：管理端保存为完整快照，删除项不应被 merge 复活
    if (keyName === 'items') {
      return newValue;
    }
    if (newValue.length > 0 && newValue[0]?.id && Array.isArray(oldValue)) {
      const result = [...oldValue] as any[];
      for (const newItem of newValue) {
        const index = result.findIndex((oldItem) => oldItem?.id === newItem.id);
        if (index >= 0) {
          result[index] = mergeConfigValue(result[index], newItem, keyName) as any;
        } else {
          result.push(newItem);
        }
      }
      return result;
    }
    return newValue;
  }

  if (newValue && typeof newValue === 'object') {
    const result = oldValue && typeof oldValue === 'object' ? { ...(oldValue as any) } : {};
    for (const [key, childValue] of Object.entries(newValue)) {
      result[key] = mergeConfigValue(result[key], childValue, key);
    }
    return result;
  }

  return newValue;
}

export function mergeSettingsUpdate(
  currentSettings: SystemSettings,
  newSettings: Partial<SystemSettings>
): SystemSettings {
  return mergeConfigValue(currentSettings, newSettings) as SystemSettings;
}

export function assertProductionSettings(settings: SystemSettings): void {
  if (process.env.NODE_ENV !== 'production') return;

  const password = settings.SYSTEM_PASSWORD?.trim();
  if (!password || password === 'admin123') {
    throw new Error('生产环境必须设置非默认 SYSTEM_PASSWORD。');
  }

  const policySecret = process.env.AI_BUILDER_POLICY_SECRET || settings.AI_BUILDER_POLICY_SECRET;
  if (!policySecret || String(policySecret).trim() === 'linkloom-ai-builder') {
    throw new Error('生产环境必须设置 AI_BUILDER_POLICY_SECRET。');
  }
}
