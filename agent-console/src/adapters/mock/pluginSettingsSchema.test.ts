import { describe, expect, it } from 'vitest';

import {
  enrichToolPayload,
  PLUGIN_SETTINGS_SCHEMA_MOCKS,
  resolvePluginSettingsSchema,
} from './pluginSettingsSchema';

describe('pluginSettingsSchema', () => {
  it('resolves known plugin ids', () => {
    expect(resolvePluginSettingsSchema('web-browsing')).toEqual(
      PLUGIN_SETTINGS_SCHEMA_MOCKS['web-browsing'],
    );
    expect(resolvePluginSettingsSchema('linkloom-sandbox')?.properties).toHaveProperty('timeout');
  });

  it('aliases lobe-web-browsing to web-browsing schema', () => {
    expect(resolvePluginSettingsSchema('linkloom-web-browsing')).toEqual(
      PLUGIN_SETTINGS_SCHEMA_MOCKS['web-browsing'],
    );
  });

  it('resolves mcp-prefixed plugins to generic mcp schema', () => {
    expect(resolvePluginSettingsSchema('mcp:filesystem')).toEqual(
      PLUGIN_SETTINGS_SCHEMA_MOCKS.mcp,
    );
  });

  it('enrichToolPayload preserves explicit settingsSchema', () => {
    const custom = { properties: { foo: { type: 'string' } }, type: 'object' };
    const tool = enrichToolPayload({
      plugin: 'web-browsing',
      settingsSchema: custom,
    });
    expect(tool.settingsSchema).toBe(custom);
  });

  it('enrichToolPayload fills schema from plugin id', () => {
    const tool = enrichToolPayload({
      identifier: 'linkloom-local-system',
      plugin: 'linkloom-local-system',
    });
    expect(tool.settingsSchema).toEqual(PLUGIN_SETTINGS_SCHEMA_MOCKS['linkloom-local-system']);
  });

  it('enrichToolPayload leaves unknown plugins unchanged', () => {
    const tool = enrichToolPayload({ plugin: 'unknown-plugin' });
    expect(tool.settingsSchema).toBeUndefined();
  });
});
