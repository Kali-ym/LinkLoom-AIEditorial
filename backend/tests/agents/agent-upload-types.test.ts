import { describe, expect, it } from 'vitest';
import {
  assertUploadSize,
  isAllowedUploadMime,
  MAX_UPLOAD_BYTES,
} from '../../src/services/agents/agentUploadTypes.js';

describe('agentUploadTypes', () => {
  it('allows common chat attachment mime types', () => {
    expect(isAllowedUploadMime('image/png')).toBe(true);
    expect(isAllowedUploadMime('text/plain')).toBe(true);
    expect(isAllowedUploadMime('application/pdf')).toBe(true);
    expect(isAllowedUploadMime('video/mp4')).toBe(true);
  });

  it('rejects unsupported mime types', () => {
    expect(isAllowedUploadMime('application/zip')).toBe(false);
    expect(isAllowedUploadMime('application/octet-stream')).toBe(false);
  });

  it('enforces max upload size', () => {
    expect(() => assertUploadSize(0)).toThrow(/empty/i);
    expect(() => assertUploadSize(MAX_UPLOAD_BYTES + 1)).toThrow(/exceeds/i);
    expect(() => assertUploadSize(1024)).not.toThrow();
  });
});
