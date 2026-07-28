import { describe, expect, it } from 'vitest';
import { extractInteropApiKey } from '../src/api/extractInteropApiKey.js';

describe('extractInteropApiKey', () => {
  it('reads x-api-key', () => {
    expect(extractInteropApiKey({ 'x-api-key': 'sk_pf_abc' })).toBe('sk_pf_abc');
  });

  it('reads Bearer sk_pf_ token', () => {
    expect(extractInteropApiKey({ authorization: 'Bearer sk_pf_deadbeef' })).toBe('sk_pf_deadbeef');
  });

  it('ignores JWT-looking Bearer tokens', () => {
    expect(extractInteropApiKey({ authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.xx.yy' })).toBeUndefined();
  });

  it('prefers x-api-key over Authorization', () => {
    expect(
      extractInteropApiKey({
        'x-api-key': 'sk_pf_from_header',
        authorization: 'Bearer sk_pf_from_auth'
      })
    ).toBe('sk_pf_from_header');
  });
});
