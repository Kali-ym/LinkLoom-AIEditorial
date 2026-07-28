import { describe, expect, it } from 'vitest';

import { ShareNotAvailableError } from '../shareDeferAdapter';
import { apiSharePort } from './sharePort';

describe('apiSharePort', () => {
  it('returns empty share map on bootstrap read', async () => {
    await expect(apiSharePort.getShareByTopicId()).resolves.toEqual({});
  });

  it('returns null for a single topic', async () => {
    await expect(apiSharePort.getShare('session_abc')).resolves.toBeNull();
  });

  it('rejects visibility updates with ShareNotAvailableError', async () => {
    await expect(apiSharePort.updateVisibility('session_abc', 'link')).rejects.toBeInstanceOf(
      ShareNotAvailableError,
    );
  });
});
