import { describe, expect, it } from 'vitest';
import {
  isComposioOAuthToolId,
  isMcpToolKey,
  mcpIdFromToolKey,
  toMcpToolKey,
} from '../../src/services/agents/toolAuthCatalog.js';

describe('toolAuthCatalog', () => {
  it('detects composio oauth tool ids', () => {
    expect(isComposioOAuthToolId('composio-github')).toBe(true);
    expect(isComposioOAuthToolId('composio-custom')).toBe(true);
    expect(isComposioOAuthToolId('query_memory')).toBe(false);
  });

  it('maps mcp tool keys', () => {
    expect(toMcpToolKey('sandbox')).toBe('mcp:sandbox');
    expect(isMcpToolKey('mcp:sandbox')).toBe(true);
    expect(mcpIdFromToolKey('mcp:sandbox')).toBe('sandbox');
  });
});
