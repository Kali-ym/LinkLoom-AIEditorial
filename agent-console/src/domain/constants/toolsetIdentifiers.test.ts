import { describe, expect, it } from 'vitest';

import { TOOLSET_IDS, resolveRegistryToolsetId } from './toolsetIdentifiers';

describe('resolveRegistryToolsetId', () => {
  it('passes through linkloom ids unchanged', () => {
    expect(resolveRegistryToolsetId(TOOLSET_IDS.KNOWLEDGE_BASE)).toBe('linkloom-knowledge-base');
    expect(resolveRegistryToolsetId(TOOLSET_IDS.AGENT)).toBe('linkloom-agent');
    expect(resolveRegistryToolsetId(TOOLSET_IDS.MCP)).toBe('codex');
  });

  it('normalizes legacy lobe ids and web-browsing shorthand', () => {
    expect(resolveRegistryToolsetId('linkloom-knowledge-base')).toBe('linkloom-knowledge-base');
    expect(resolveRegistryToolsetId('linkloom-agent')).toBe('linkloom-agent');
    expect(resolveRegistryToolsetId('web-browsing')).toBe('linkloom-web-browsing');
  });

  it('passes through unknown ids', () => {
    expect(resolveRegistryToolsetId('custom-plugin')).toBe('custom-plugin');
  });

  it('canonical ids use linkloom prefix', () => {
    for (const id of Object.values(TOOLSET_IDS)) {
      expect(id.startsWith('linkloom-') || id === 'linkloom-generic').toBe(true);
    }
  });
});
