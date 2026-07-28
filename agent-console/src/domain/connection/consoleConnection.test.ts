// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  clearConnection,
  maskApiKey,
  normalizeBaseUrl,
  readConnection,
  readLastBaseUrl,
  writeConnection,
  CONNECTION_STORAGE_KEY,
  LAST_BASE_URL_STORAGE_KEY,
  LEGACY_AUTH_TOKEN_KEY,
} from './consoleConnection';

describe('consoleConnection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('normalizes base URLs', () => {
    expect(normalizeBaseUrl('http://120.48.111.74:3000/')).toBe('http://120.48.111.74:3000');
    expect(normalizeBaseUrl('120.48.111.74:3000')).toBe('http://120.48.111.74:3000');
  });

  it('persists and clears connection while keeping last base URL', () => {
    localStorage.setItem(LEGACY_AUTH_TOKEN_KEY, 'old-jwt');
    writeConnection({
      baseUrl: 'http://example.com:3000',
      apiKey: 'sk_pf_abcdefghijklmnop',
      connectedAt: '2026-07-28T00:00:00.000Z',
    });

    expect(readConnection()?.apiKey).toBe('sk_pf_abcdefghijklmnop');
    expect(localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)).toBeNull();

    clearConnection();
    expect(readConnection()).toBeNull();
    expect(localStorage.getItem(CONNECTION_STORAGE_KEY)).toBeNull();
    expect(readLastBaseUrl()).toBe('http://example.com:3000');
    expect(localStorage.getItem(LAST_BASE_URL_STORAGE_KEY)).toBe('http://example.com:3000');
  });

  it('masks api keys', () => {
    expect(maskApiKey('sk_pf_abcdefghijklmnop')).toBe('sk_pf_…mnop');
  });
});
