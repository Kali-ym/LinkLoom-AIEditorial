import { describe, expect, it } from 'vitest';
import {
  applyAuthoritativeArraySnapshots,
  hashPassword,
  isMaskedSecret,
  maskSettingsForResponse,
  mergeSettingsUpdate,
  replaceIdArraySnapshot,
  resolveProviderConfigForRuntime,
  verifyPassword
} from '../src/services/settingsSecurity.js';
import type { SystemSettings } from '../src/types/config.js';

const baseSettings = {
  ACTIVE_AI_PROVIDER_ID: 'openai',
  AI_PROVIDERS: [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'OPENAI',
      apiUrl: '',
      apiKey: 'sk-secret-value',
      models: [],
      enabled: true,
      useProxy: false
    }
  ],
  PUBLISHERS: [],
  STORAGES: [],
  SYSTEM_PASSWORD: 'old-password',
  AUTH_EXPIRE_TIME: '7d',
  API_PROXY: '',
  IMAGE_PROXY: '',
  ADAPTERS: [],
  CATEGORIES: [],
  SELECTION_FETCH_DAYS: 3,
  SELECTION_QUERY_FIELD: 'ingestion_date'
} satisfies SystemSettings;

describe('settingsSecurity', () => {
  it('masks secrets before returning settings', () => {
    const masked = maskSettingsForResponse(baseSettings);
    expect(masked.SYSTEM_PASSWORD).toBeUndefined();
    expect(masked.AI_PROVIDERS[0].apiKey).toMatch(/^sk-s/);
    expect(masked.AI_PROVIDERS[0].apiKey).not.toBe('sk-secret-value');
  });

  it('keeps existing secret values when masked placeholders are submitted', () => {
    const merged = mergeSettingsUpdate(baseSettings, {
      AI_PROVIDERS: [{ id: 'openai', apiKey: 'sk-s...alue' } as any]
    });
    expect(merged.AI_PROVIDERS[0].apiKey).toBe('sk-secret-value');
  });

  it('hashes and verifies password updates', () => {
    const merged = mergeSettingsUpdate(baseSettings, { SYSTEM_PASSWORD: 'new-password' });
    expect(merged.SYSTEM_PASSWORD).not.toBe('new-password');
    expect(verifyPassword('new-password', merged.SYSTEM_PASSWORD!)).toBe(true);
    expect(verifyPassword('bad-password', merged.SYSTEM_PASSWORD!)).toBe(false);
    expect(verifyPassword('plain', 'plain')).toBe(true);
    expect(hashPassword('x')).toMatch(/^scrypt\$/);
  });

  it('drops removed adapter items when saving a snapshot list', () => {
    const oldAdapters = [
      {
        id: 'rss-adapter',
        name: 'RSS',
        adapterType: 'RSSAdapter',
        enabled: true,
        items: [
          { id: 'keep', name: '保留' },
          { id: 'remove', name: '阮一峰的网络日志' }
        ]
      }
    ];
    const newAdapters = [
      {
        id: 'rss-adapter',
        name: 'RSS',
        adapterType: 'RSSAdapter',
        enabled: true,
        items: [{ id: 'keep', name: '保留' }]
      }
    ];
    const replaced = replaceIdArraySnapshot(oldAdapters, newAdapters, 'ADAPTERS') as any[];
    expect(replaced).toHaveLength(1);
    expect(replaced[0].items).toHaveLength(1);
    expect(replaced[0].items[0].id).toBe('keep');
  });

  it('detects masked api key placeholders', () => {
    expect(isMaskedSecret('sk-7...485f')).toBe(true);
    expect(isMaskedSecret('sk-real-key-value')).toBe(false);
  });

  it('resolveProviderConfigForRuntime fills apiKey from stored settings', () => {
    const settings = {
      ...baseSettings,
      AI_PROVIDERS: [
        {
          id: 'claude',
          name: 'Claude',
          type: 'OPENAI',
          apiUrl: 'https://example.com',
          apiKey: 'sk-full-secret-key-12345',
          models: [],
          enabled: true,
          useProxy: false
        }
      ]
    } satisfies SystemSettings;
    const resolved = resolveProviderConfigForRuntime(
      { id: 'claude', apiUrl: 'https://example.com', apiKey: 'sk-7...2345' },
      settings
    );
    expect(resolved.apiKey).toBe('sk-full-secret-key-12345');
  });

  it('replaceIdArraySnapshot preserves apiKey when client sends mask', () => {
    const oldProviders = [
      {
        id: 'claude',
        name: 'Claude',
        type: 'OPENAI',
        apiUrl: 'https://example.com',
        apiKey: 'sk-full-secret-key-12345',
        models: [],
        enabled: true,
        useProxy: false
      }
    ];
    const newProviders = [
      {
        id: 'claude',
        name: 'Claude',
        type: 'OPENAI',
        apiUrl: 'https://yzhanghmeng.com',
        apiKey: 'sk-7...2345',
        models: ['gpt-3.5'],
        enabled: true,
        useProxy: false
      }
    ];
    const replaced = replaceIdArraySnapshot(oldProviders, newProviders, 'AI_PROVIDERS') as any[];
    expect(replaced[0].apiKey).toBe('sk-full-secret-key-12345');
    expect(replaced[0].apiUrl).toBe('https://yzhanghmeng.com');
  });

  it('applyAuthoritativeArraySnapshots removes deleted top-level adapters', () => {
    const current = {
      ...baseSettings,
      ADAPTERS: [
        {
          id: 'follow-api',
          name: 'Folo',
          adapterType: 'FollowApiAdapter',
          enabled: true,
          items: []
        },
        { id: 'rss-adapter', name: 'RSS', adapterType: 'RSSAdapter', enabled: true, items: [] }
      ]
    } satisfies SystemSettings;
    const newSettings = {
      ADAPTERS: [
        { id: 'rss-adapter', name: 'RSS', adapterType: 'RSSAdapter', enabled: true, items: [] }
      ]
    };
    const merged = mergeSettingsUpdate(current, newSettings);
    const final = applyAuthoritativeArraySnapshots(current, newSettings, merged);
    expect(final.ADAPTERS).toHaveLength(1);
    expect(final.ADAPTERS[0].id).toBe('rss-adapter');
  });

  it('preserves small model apiKey masks while honoring deleted small model services', () => {
    const current = {
      ...baseSettings,
      ACTIVE_EMBEDDING_SERVICE_ID: 'embed-1',
      SMALL_MODEL_SERVICES: [
        {
          id: 'embed-1',
          name: 'Embedding A',
          role: 'EMBEDDING',
          backend: 'OPENAI_COMPAT',
          apiUrl: 'https://embed.example.com',
          apiKey: 'sk-full-embedding-secret-12345',
          model: 'text-embedding',
          dimensions: 1024,
          enabled: true,
          useProxy: false
        },
        {
          id: 'rerank-1',
          name: 'Rerank A',
          role: 'RERANK',
          backend: 'OPENAI_COMPAT',
          apiUrl: 'https://rerank.example.com',
          apiKey: 'sk-rerank-secret-12345',
          model: 'rerank',
          enabled: true,
          useProxy: false
        }
      ]
    } satisfies SystemSettings;
    const newSettings = {
      SMALL_MODEL_SERVICES: [
        {
          id: 'embed-1',
          name: 'Embedding A Updated',
          role: 'EMBEDDING',
          backend: 'OPENAI_COMPAT',
          apiUrl: 'https://embed-updated.example.com',
          apiKey: 'sk-f...2345',
          model: 'text-embedding-v2',
          dimensions: 1024,
          enabled: true,
          useProxy: false
        }
      ]
    };

    const merged = mergeSettingsUpdate(current, newSettings as Partial<SystemSettings>);
    const final = applyAuthoritativeArraySnapshots(current, newSettings as Partial<SystemSettings>, merged);

    expect(final.SMALL_MODEL_SERVICES).toHaveLength(1);
    expect(final.SMALL_MODEL_SERVICES?.[0].id).toBe('embed-1');
    expect(final.SMALL_MODEL_SERVICES?.[0].name).toBe('Embedding A Updated');
    expect(final.SMALL_MODEL_SERVICES?.[0].apiKey).toBe('sk-full-embedding-secret-12345');
    expect(final.SMALL_MODEL_SERVICES?.some((svc) => svc.id === 'rerank-1')).toBe(false);
  });
});
