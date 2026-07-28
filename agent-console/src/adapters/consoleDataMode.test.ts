import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  enrichToolPayload,
  enrichToolPayloads,
  resolvePluginSettingsSchema,
} from './consoleDataMode';
import { PLUGIN_SETTINGS_SCHEMA_MOCKS } from './mock/pluginSettingsSchema';

describe('consoleDataMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('api mode passes tool payloads through without mock settingsSchema', () => {
    vi.stubEnv('VITE_AGENT_CONSOLE_DATA', 'api');

    const tool = enrichToolPayload({
      identifier: 'linkloom-knowledge-base',
      plugin: 'web-browsing',
      apiName: 'searchKnowledgeBase',
    });

    expect(tool.settingsSchema).toBeUndefined();
    expect(resolvePluginSettingsSchema('web-browsing')).toBeUndefined();
  });

  it('defaults to api mode when VITE_AGENT_CONSOLE_DATA is unset', () => {
    vi.stubEnv('VITE_AGENT_CONSOLE_DATA', '');

    const tool = enrichToolPayload({
      identifier: 'linkloom-knowledge-base',
      plugin: 'web-browsing',
      apiName: 'searchKnowledgeBase',
    });

    expect(tool.settingsSchema).toBeUndefined();
  });

  it('mock mode fills settingsSchema from plugin manifest mocks', () => {
    vi.stubEnv('VITE_AGENT_CONSOLE_DATA', 'mock');

    const tool = enrichToolPayload({
      identifier: 'linkloom-local-system',
      plugin: 'linkloom-local-system',
    });

    expect(tool.settingsSchema).toEqual(PLUGIN_SETTINGS_SCHEMA_MOCKS['linkloom-local-system']);
    expect(enrichToolPayloads([tool])[0].settingsSchema).toEqual(
      PLUGIN_SETTINGS_SCHEMA_MOCKS['linkloom-local-system'],
    );
  });
});
