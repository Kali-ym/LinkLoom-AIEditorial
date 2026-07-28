import { describe, expect, it } from 'vitest';
import { resolveSmallModelConfigForRuntime } from '../src/services/settingsSecurity.js';
import type { SystemSettings } from '../src/types/config.js';

describe('resolveSmallModelConfigForRuntime', () => {
  const settings = {
    SMALL_MODEL_SERVICES: [
      {
        id: 'embed-1',
        name: 'Embedding',
        role: 'EMBEDDING',
        backend: 'OPENAI_COMPAT',
        apiUrl: 'https://example.com',
        apiKey: 'stored-secret',
        model: 'mock',
        dimensions: 1024,
        enabled: true,
        useProxy: false
      }
    ]
  } as SystemSettings;

  it('fills apiKey from stored settings when client sends masked placeholder', () => {
    const resolved = resolveSmallModelConfigForRuntime(
      { id: 'embed-1', apiKey: '••••••••••••••••' },
      settings
    );
    expect(resolved.apiKey).toBe('stored-secret');
  });
});
